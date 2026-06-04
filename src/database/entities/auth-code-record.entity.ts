import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('auth_code_records')
export class AuthCodeRecordEntity {
  @PrimaryColumn()
  code!: string;

  @Column()
  teamsUserId!: string;

  @Column({ type: 'bigint' })
  expiresAt!: string;
}
