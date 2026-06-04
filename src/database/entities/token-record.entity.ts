import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('token_records')
export class TokenRecordEntity {
  @PrimaryColumn()
  teamsUserId!: string;

  @Column({ type: 'int' })
  canvasUserId!: number;

  @Column({ type: 'text' })
  accessTokenEncrypted!: string;

  @Column({ type: 'text' })
  refreshTokenEncrypted!: string;

  @Column()
  expiresAt!: Date;

  @Column()
  lastActiveAt!: Date;
}
