import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('trivia_scores')
@Index('idx_trivia_week_user', ['weekStart', 'userId'])
export class TriviaScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'int' })
  score: number;

  @Column({ name: 'correct_answers', type: 'int' })
  correctAnswers: number;

  @Column({ name: 'total_questions', type: 'int', default: 10 })
  totalQuestions: number;

  @Column({ name: 'round_number', type: 'int' })
  roundNumber: number;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @CreateDateColumn({ name: 'played_at' })
  playedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
