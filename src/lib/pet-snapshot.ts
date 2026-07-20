/** JSON-safe pet payload shared by GET/POST `/api/pet/xp` (US-4.10). */
export type PetSnapshot = {
  id: string;
  name: string;
  xp: number;
  level: number;
  stage: string;
  streakCount: number;
};
