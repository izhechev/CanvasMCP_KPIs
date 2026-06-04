import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('oauth_state_records')
export class OAuthStateRecordEntity {
  @PrimaryColumn()
  state!: string;

  @Column()
  teamsUserId!: string;

  @Column({ type: 'text' })
  codeVerifier!: string;

  @Column({ type: 'text', nullable: true })
  returnTo!: string | null;

  @Column({ type: 'bigint' })
  expiresAt!: string;
}
