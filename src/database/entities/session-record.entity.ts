import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('session_records')
export class SessionRecordEntity {
  @PrimaryColumn()
  token!: string;

  @Column()
  teamsUserId!: string;

  @Column({ type: 'bigint' })
  expiresAt!: string;
}
