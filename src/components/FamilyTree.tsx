import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FamilyMember } from '../types';
import { Download, Loader2, Languages } from 'lucide-react';
import { translations, Language } from '../i18n';

interface FamilyTreeProps {
  members: FamilyMember[];
  onMemberClick: (member: FamilyMember) => void;
  currentUserId?: string;
  centerOnId?: string | null;
  language: Language;
}

export const FamilyTree: React.FC<FamilyTreeProps> = ({ members, onMemberClick, currentUserId, centerOnId, language }) => {
  const t = translations[language];
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!svgRef.current || members.length === 0) return;

    const width = 1200;
    const height = 800;

    // Clear previous SVG content
    d3.select(svgRef.current).selectAll('*').remove();

      const svg = d3.select(svgRef.current)
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('background', '#fdfbf7');

    const g = svg.append('g');
    gRef.current = g.node() as SVGGElement;

    // Create hierarchy
    const virtualRootId = 'virtual-root';
    
    // Identify sibling groups (no parents, but have siblings)
    const siblingGroupIds: string[] = Array.from(new Set(
      members
        .filter(m => !m.fatherId && !m.motherId && m.siblingIds && m.siblingIds.length > 0)
        .map(m => `sib-group-${[m.id, ...(m.siblingIds || [])].sort()[0]}`)
    ));

    // Identify couple groups (no parents, but are a couple)
    const coupleGroupIds = Array.from(new Set(
      members
        .filter(m => !m.fatherId && !m.motherId && m.spouseId && !siblingGroupIds.some(sg => sg.includes(m.id)))
        .map(m => `couple-group-${[m.id, m.spouseId!].sort()[0]}`)
    ));

    // Identify union nodes (couples with children)
    const unions: { id: string, fatherId: string, motherId: string, parentId: string }[] = [];
    const processedUnions = new Set<string>();
    
    members.forEach(m => {
      // Case 1: Child has both parents set
      if (m.fatherId && m.motherId) {
        const unionId = `union-${m.fatherId}-${m.motherId}`;
        if (!processedUnions.has(unionId)) {
          const fatherExists = members.some(p => p.id === m.fatherId);
          const motherExists = members.some(p => p.id === m.motherId);
          
          if (fatherExists || motherExists) {
            unions.push({
              id: unionId,
              fatherId: m.fatherId!,
              motherId: m.motherId!,
              parentId: fatherExists ? m.fatherId! : m.motherId!
            });
            processedUnions.add(unionId);
          }
        }
      } 
      // Case 2: Child has one parent set, and that parent has a spouse
      else if (m.fatherId || m.motherId) {
        const parentId = m.fatherId || m.motherId;
        const parent = members.find(p => p.id === parentId);
        if (parent && parent.spouseId) {
          const spouse = members.find(s => s.id === parent.spouseId);
          if (spouse) {
            const fatherId = parent.gender === 'male' || spouse.gender === 'female' ? parent.id : spouse.id;
            const motherId = parent.gender === 'female' || spouse.gender === 'male' ? parent.id : spouse.id;
            const unionId = `union-${fatherId}-${motherId}`;
            
            if (!processedUnions.has(unionId)) {
              unions.push({
                id: unionId,
                fatherId: fatherId!,
                motherId: motherId!,
                parentId: fatherId! // Use father as anchor
              });
              processedUnions.add(unionId);
            }
          }
        }
      }
    });

    const dataWithVirtualRoot = [
      { id: virtualRootId, firstName: 'Ancestors', lastName: '', gender: 'other', isVirtual: true } as any,
      ...siblingGroupIds.map(id => ({ id, firstName: '', lastName: '', gender: 'other', parentId: virtualRootId, isVirtual: true } as any)),
      ...coupleGroupIds.map(id => ({ id, firstName: '', lastName: '', gender: 'other', parentId: virtualRootId, isVirtual: true } as any)),
      ...unions.map(u => ({ id: u.id, firstName: '', lastName: '', gender: 'other', parentId: u.parentId, isVirtual: true, isUnion: true, fatherId: u.fatherId, motherId: u.motherId } as any)),
      ...members.map(m => {
        let parentId = m.fatherId || m.motherId;
        let isPulledSpouse = false;
        
        // 1. If child has both parents OR one parent with a spouse, point to the union node
        const parentIdRaw = m.fatherId || m.motherId;
        const parent = parentIdRaw ? members.find(p => p.id === parentIdRaw) : null;
        
        if (m.fatherId && m.motherId) {
          parentId = `union-${m.fatherId}-${m.motherId}`;
        } else if (parent && parent.spouseId) {
          const spouse = members.find(s => s.id === parent.spouseId);
          if (spouse) {
            const fatherId = parent.gender === 'male' || spouse.gender === 'female' ? parent.id : spouse.id;
            const motherId = parent.gender === 'female' || spouse.gender === 'male' ? parent.id : spouse.id;
            parentId = `union-${fatherId}-${motherId}`;
          }
        } else if (!parentId && m.spouseId) {
          // Pull spouse to the same parent as their partner to keep them together
          const spouse = members.find(s => s.id === m.spouseId);
          if (spouse) {
            // If spouse has both parents, pull to their union node
            if (spouse.fatherId && spouse.motherId) {
              parentId = `union-${spouse.fatherId}-${spouse.motherId}`;
              isPulledSpouse = true;
            } else if (spouse.fatherId || spouse.motherId) {
              parentId = spouse.fatherId || spouse.motherId;
              isPulledSpouse = true;
            } else {
              // If spouse is also a root, attach to the spouse itself
              // This ensures they are adjacent in the tree layout
              // TIE-BREAKER: Only pull if current member ID is "greater" than spouse ID
              // to prevent circular references (A -> B and B -> A)
              if (m.id > spouse.id) {
                parentId = spouse.id;
                isPulledSpouse = true;
              }
            }
          }
        }

        // 2. Try to pull siblings into the same branch
        if (!parentId) {
          const sibling = members.find(s => 
            s.id !== m.id && 
            (s.fatherId || s.motherId) &&
            (
              (s.fatherId && s.fatherId === m.fatherId) || 
              (s.motherId && s.motherId === m.motherId) ||
              (m.siblingIds && m.siblingIds.includes(s.id))
            )
          );
          if (sibling) {
            if (sibling.fatherId && sibling.motherId) {
              parentId = `union-${sibling.fatherId}-${sibling.motherId}`;
            } else {
              const sParent = members.find(p => p.id === (sibling.fatherId || sibling.motherId));
              if (sParent && sParent.spouseId) {
                const fId = sParent.gender === 'male' ? sParent.id : sParent.spouseId;
                const mId = sParent.gender === 'female' ? sParent.id : sParent.spouseId;
                parentId = `union-${fId}-${mId}`;
              } else {
                parentId = sibling.fatherId || sibling.motherId;
              }
            }
          }
        }
        
        // 3. If still no parent, check if part of a sibling group
        if (!parentId && m.siblingIds && m.siblingIds.length > 0) {
          const sortedSibs = [m.id, ...m.siblingIds].sort();
          parentId = `sib-group-${sortedSibs[0]}`;
        }

        // 4. If still no parent, check if part of a couple group
        if (!parentId && m.spouseId) {
          parentId = `couple-group-${[m.id, m.spouseId].sort()[0]}`;
        }

        const parentExists = members.some(parent => parent.id === parentId) || 
                           siblingGroupIds.includes(parentId!) || 
                           coupleGroupIds.includes(parentId!) ||
                           unions.some(u => u.id === parentId);
                           
        return {
          ...m,
          parentId: parentExists ? parentId : virtualRootId,
          isVirtual: false,
          isPulledSpouse
        };
      })
    ];
    
    const stratify = d3.stratify<any>()
      .id(d => d.id)
      .parentId(d => d.parentId);

    try {
      const root = stratify(dataWithVirtualRoot);
      
      root.descendants().forEach(node => {
        if (node.children) {
          node.sort((a, b) => {
            const aNames = a.descendants().map(d => d.data.firstName?.toLowerCase());
            const bNames = b.descendants().map(d => d.data.firstName?.toLowerCase());
            
            const hasKinanA = aNames.includes('kinan');
            const hasHnenA = aNames.includes('hnen');
            const hasKinanB = bNames.includes('kinan');
            const hasHnenB = bNames.includes('hnen');

            // Priority 1: Keep Kinan and Hnen branches adjacent
            if ((hasKinanA && hasHnenB) || (hasHnenA && hasKinanB)) return -1;
            
            // Priority 2: Move Kinan/Hnen branches to the start of the list
            if (hasKinanA || hasHnenA) return -1;
            if (hasKinanB || hasHnenB) return 1;

            // Priority 3: Original marriage link logic for root level
            if (node.id === virtualRootId) {
              const aDesc = a.descendants().map(d => d.id);
              const bDesc = b.descendants().map(d => d.id);
              const isLinked = members.some(m => 
                m.spouseId && 
                ((aDesc.includes(m.id) && bDesc.includes(m.spouseId)) || 
                 (bDesc.includes(m.id) && aDesc.includes(m.spouseId)))
              );
              return isLinked ? -1 : 0;
            }
            
            return 0;
          });
        }
      });

      const treeLayout = d3.tree<any>().nodeSize([220, 260]); 
      treeLayout(root);

      // Nudge Kinan and Hnen branches closer together
      const kinanNode = root.descendants().find(d => d.data.firstName?.toLowerCase() === 'kinan');
      const hnenNode = root.descendants().find(d => d.data.firstName?.toLowerCase() === 'hnen');
      
      if (kinanNode && hnenNode) {
        const targetX = (kinanNode.x + hnenNode.x) / 2;
        const nudgeKinan = (targetX - kinanNode.x) * 0.4;
        const nudgeHnen = (targetX - hnenNode.x) * 0.4;
        
        // Nudge the entire subtrees (including children)
        kinanNode.descendants().forEach(d => (d as any).x += nudgeKinan);
        hnenNode.descendants().forEach(d => (d as any).x += nudgeHnen);
      }

      // Invert Y coordinates to make it grow UPWARDS like a real tree
      const maxY = d3.max(root.descendants(), d => (d as any).y) || 0;
      root.descendants().forEach(node => {
        (node as any).y = maxY - (node as any).y + 100;
      });

      // Manually position pulled spouses next to their partners at the same level
      root.descendants().forEach(node => {
        if (node.data.isPulledSpouse) {
          const spouse = node.parent; // The anchor partner
          if (spouse) {
            (node as any).y = spouse.y;
            (node as any).x = spouse.x + 160; 
          }
        }
      });

      // Manually position union nodes between parents
      root.descendants().forEach(node => {
        if (node.data.isUnion) {
          const father = root.descendants().find(n => n.id === node.data.fatherId);
          const mother = root.descendants().find(n => n.id === node.data.motherId);
          if (father && mother) {
            (node as any).x = (father.x + mother.x) / 2;
            (node as any).y = Math.min(father.y, mother.y) - 80; // Above parents in inverted view
          }
        }
      });

      // Branch-like links
      const standardLinks = root.links().filter(l => {
        const s = l.source;
        const t = l.target;
        if (s.data.isVirtual && s.id === virtualRootId) return false;
        if (t.data.isPulledSpouse) return false;
        if (s.id.toString().startsWith('couple-group-')) return false;
        if (t.data.isUnion) return false; 
        return true;
      });

      // Marriage bar and children links
      const marriageLinks: any[] = [];
      const childrenLinks: any[] = [];
      
      root.descendants().forEach(node => {
        if (node.data.isUnion) {
          const father = root.descendants().find(n => n.id === node.data.fatherId);
          const mother = root.descendants().find(n => n.id === node.data.motherId);
          if (father && mother) {
            marriageLinks.push({ father, mother, union: node });
          }
          // Children of this union
          node.children?.forEach(child => {
            childrenLinks.push({ source: node, target: child });
          });
        }
      });

      // Helper for organic branch paths
      const organicPath = (sx: number, sy: number, tx: number, ty: number) => {
        const dx = tx - sx;
        const dy = ty - sy;
        const cp1x = sx + dx * 0.1;
        const cp1y = sy + dy * 0.5;
        const cp2x = sx + dx * 0.9;
        const cp2y = sy + dy * 0.5;
        return `M${sx},${sy} C${cp1x},${cp1y} ${cp2x},${cp2y} ${tx},${ty}`;
      };

      // Draw a "Trunk" at the base
      const trunkBaseX = root.x;
      const trunkBaseY = maxY + 200;

      // Draw a "Ground" line
      g.append('line')
        .attr('x1', trunkBaseX - 300)
        .attr('y1', trunkBaseY)
        .attr('x2', trunkBaseX + 300)
        .attr('y2', trunkBaseY)
        .attr('stroke', '#8D6E63')
        .attr('stroke-width', 4)
        .attr('stroke-dasharray', '10,5');

      g.append('path')
        .attr('d', `M${trunkBaseX-20},${trunkBaseY} Q${trunkBaseX},${maxY+100} ${root.x},${root.y}`)
        .attr('fill', 'none')
        .attr('stroke', '#5D4037')
        .attr('stroke-width', 15)
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.8);

      // Draw Marriage Bars (Roots/Main Branches)
      const marriageBarGroup = g.selectAll('.marriage-bar')
        .data(marriageLinks)
        .enter()
        .append('g')
        .attr('class', 'marriage-bar');

      marriageBarGroup.append('path')
        .attr('d', (d: any) => {
          const f = d.father;
          const m = d.mother;
          const u = d.union;
          // Curved lines down from parents to union
          const pathF = organicPath(f.x, f.y, u.x, u.y);
          const pathM = organicPath(m.x, m.y, u.x, u.y);
          return `${pathF} ${pathM}`;
        })
        .attr('fill', 'none')
        .attr('stroke', '#8B4513') // SaddleBrown for branches
        .attr('stroke-width', (d: any) => Math.max(2, 8 - (d.union.depth * 1.5)))
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.6);

      // Draw Children Branches from Union
      g.selectAll('.child-link')
        .data(childrenLinks)
        .enter()
        .append('path')
        .attr('class', 'child-link')
        .attr('d', (d: any) => organicPath(d.source.x, d.source.y, d.target.x, d.target.y))
        .attr('fill', 'none')
        .attr('stroke', '#8B4513')
        .attr('stroke-width', (d: any) => Math.max(1.5, 6 - (d.target.depth * 1.2)))
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.5);

      // Add decorative leaves along branches
      const allLinks = [...standardLinks, ...childrenLinks];
      g.selectAll('.deco-leaf')
        .data(allLinks.filter((_, i) => i % 2 === 0)) // Only on some links
        .enter()
        .append('path')
        .attr('d', 'M0,0 C5,-5 10,-5 10,0 C10,5 5,5 0,0')
        .attr('fill', '#8bc34a')
        .attr('opacity', 0.4)
        .attr('transform', (d: any) => {
          const midX = (d.source.x + d.target.x) / 2;
          const midY = (d.source.y + d.target.y) / 2;
          const angle = Math.atan2(d.target.y - d.source.y, d.target.x - d.source.x) * 180 / Math.PI;
          return `translate(${midX},${midY}) rotate(${angle + 45}) scale(1.5)`;
        });

      // Other standard links
      g.selectAll('.link')
        .data(standardLinks)
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', (d: any) => organicPath(d.source.x, d.source.y, d.target.x, d.target.y))
        .attr('fill', 'none')
        .attr('stroke', '#8B4513')
        .attr('stroke-width', (d: any) => Math.max(1.5, 6 - (d.target.depth * 1.2)))
        .attr('stroke-linecap', 'round')
        .attr('opacity', 0.4);

      // Marriage bar and children links
      const node = g.selectAll('.node')
        .data(root.descendants().filter(d => !d.data.isVirtual))
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('id', d => `node-${d.id}`)
        .attr('transform', d => {
          const rotation = (Math.random() * 20 - 10); // Slight random tilt
          return `translate(${(d as any).x},${(d as any).y}) rotate(${rotation})`;
        })
        .on('click', (event, d) => onMemberClick(d.data))
        .style('cursor', 'pointer');

      // Node Background (Leaf Shape)
      node.append('path')
        .attr('d', 'M0,-48 C20,-48 48,-20 48,0 C48,20 20,48 0,48 C-20,48 -48,20 -48,0 C-48,-20 -20,-48 0,-48')
        .attr('fill', '#fff')
        .attr('stroke', d => {
          if (d.data.linkedUserId === currentUserId) return '#2e7d32'; // Dark Green for Me
          if (d.data.gender === 'male') return '#4caf50'; // Green
          if (d.data.gender === 'female') return '#8bc34a'; // Light Green
          return '#f1f5f9';
        })
        .attr('stroke-width', d => d.data.linkedUserId === currentUserId ? 4 : 3)
        .style('filter', 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.05))');

      // Photo Circle
      const photoSize = 78;
      node.append('clipPath')
        .attr('id', d => `clip-${d.id}`)
        .append('circle')
        .attr('r', photoSize / 2);

      node.append('image')
        .filter(d => !!d.data.photoUrl)
        .attr('xlink:href', d => d.data.photoUrl!)
        .attr('x', -photoSize / 2)
        .attr('y', -photoSize / 2)
        .attr('width', photoSize)
        .attr('height', photoSize)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('clip-path', d => `url(#clip-${d.id})`)
        .attr('crossOrigin', 'anonymous');

      // Add a small leaf stem
      node.append('path')
        .attr('d', 'M0,-48 L0,-60')
        .attr('stroke', '#8B4513')
        .attr('stroke-width', 2);

      // Add a small memorial indicator if deceased
      node.filter(d => !!d.data.deathDate)
        .append('text')
        .attr('x', 35)
        .attr('y', -35)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .text('🕊️')
        .style('filter', 'drop-shadow(0 1px 1px rgb(0 0 0 / 0.05))');

      node.append('text')
        .filter(d => !d.data.photoUrl)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '24px')
        .text('👤')
        .attr('opacity', 0.2);

      // Name Labels
      const labelGroup = node.append('g')
        .attr('transform', 'translate(0, 65)');

      labelGroup.append('text')
        .attr('text-anchor', 'middle')
        .text(d => d.data.firstName)
        .style('font-weight', 'bold')
        .style('font-size', '12px')
        .style('fill', '#0f172a');

      labelGroup.append('text')
        .attr('y', 14)
        .attr('text-anchor', 'middle')
        .text(d => d.data.lastName)
        .style('font-size', '10px')
        .style('fill', '#94a3b8');

      // Zoom behavior
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });

      zoomRef.current = zoom;
      d3.select(svgRef.current).call(zoom as any);

      // Initial center
      const initialTransform = d3.zoomIdentity.translate(width / 2, height - 100).scale(0.6);
      d3.select(svgRef.current).call(zoom.transform as any, initialTransform);

    } catch (e) {
      console.error("Failed to stratify data.", e);
    }
  }, [members, onMemberClick, currentUserId]);

  useEffect(() => {
    if (centerOnId && svgRef.current && zoomRef.current) {
      const node = d3.select(`#node-${centerOnId}`);
      if (!node.empty()) {
        const d: any = node.datum();
        const width = 1200;
        const height = 800;
        const transform = d3.zoomIdentity
          .translate(width / 2 - d.x * 1.2, height / 2 - d.y * 1.2)
          .scale(1.2);
        
        d3.select(svgRef.current)
          .transition()
          .duration(1000)
          .ease(d3.easeCubicInOut)
          .call(zoomRef.current.transform, transform);
      }
    }
  }, [centerOnId]);

  const handleExport = async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    
    try {
      const svgElement = svgRef.current;
      const mainG = svgElement.querySelector('g');
      if (!mainG) {
        setIsExporting(false);
        return;
      }

      // Get the actual bounding box of the tree content
      const bbox = mainG.getBBox();
      
      const exportWidth = 3000;
      const exportHeight = 2000;
      const padding = 150;

      // Clone the SVG
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
      
      // Ensure namespaces are present
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      clonedSvg.setAttribute('width', exportWidth.toString());
      clonedSvg.setAttribute('height', exportHeight.toString());
      clonedSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);

      // Calculate scale to fit the tree in the export dimensions
      const scale = Math.min(
        (exportWidth - padding * 2) / bbox.width,
        (exportHeight - padding * 2) / bbox.height,
        1.5 // Don't over-scale small trees
      );

      // Calculate translation to center the tree
      const translateX = (exportWidth / 2) - (bbox.x + bbox.width / 2) * scale;
      const translateY = (exportHeight / 2) - (bbox.y + bbox.height / 2) * scale;

      const rootGroup = clonedSvg.querySelector('g');
      if (rootGroup) {
        rootGroup.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);
      }

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(clonedSvg);
      
      // Add a background rectangle to the SVG string
      const bgRect = `<rect width="${exportWidth}" height="${exportHeight}" fill="#fdfbf7" />`;
      svgString = svgString.replace('>', `>${bgRect}`);

      const canvas = document.createElement('canvas');
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsExporting(false);
        return;
      }

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.fillStyle = '#fdfbf7';
        ctx.fillRect(0, 0, exportWidth, exportHeight);
        ctx.drawImage(img, 0, 0);
        
        try {
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `family-tree-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        } catch (e) {
          console.error('Canvas toDataURL error:', e);
          alert('Failed to generate PNG. This is likely due to security restrictions on profile photos from other websites.');
        }
        
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };

      img.onerror = (err) => {
        console.error('Export image load error:', err);
        URL.revokeObjectURL(url);
        setIsExporting(false);
        alert('Failed to load tree for export. Some profile photos might be blocking the process.');
      };

      img.src = url;
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      alert('An error occurred during export.');
    }
  };

  return (
    <div className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-md rounded-full border border-slate-200 shadow-sm">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.familyTree}</span>
      </div>
      
      <button 
        onClick={handleExport}
        disabled={isExporting}
        className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-sm transition-all active:scale-95 disabled:opacity-50"
      >
        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        <span className="text-xs font-bold">{t.exportHighRes}</span>
      </button>
    </div>
  );
};
