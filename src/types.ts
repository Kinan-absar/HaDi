export interface Tribute {
  id: string;
  memberId: string;
  treeId: string;
  userId: string;
  userName: string;
  content: string;
  type: 'message' | 'flower' | 'candle';
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  deathDate?: string;
  gender: 'male' | 'female' | 'other';
  bio?: string;
  photoUrl?: string;
  fatherId?: string;
  motherId?: string;
  spouseId?: string;
  siblingIds?: string[];
  userId: string; // The creator
  treeId: string; // The shared tree ID
  linkedUserId?: string; // If this record represents a registered user
  tributes?: Tribute[];
}

export interface FamilyTreeData {
  members: FamilyMember[];
}
