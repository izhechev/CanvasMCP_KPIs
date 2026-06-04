export interface StoreTokenInput {
  canvasUserId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface TokenRecord {
  teamsUserId: string;
  canvasUserId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  lastActiveAt: Date;
}
