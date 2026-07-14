import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsString,
  ValidateNested,
} from 'class-validator';

export class AnswerDto {
  @ApiProperty({ example: 0, description: 'Zero-based question index' })
  @IsInt()
  questionIndex: number;

  @ApiProperty({ example: 'Paris', description: 'Selected answer text' })
  @IsString()
  answer: string;
}

export class SubmitRoundDto {
  @ApiProperty({ description: 'Round ID returned by /trivia/start' })
  @IsString()
  roundId: string;

  @ApiProperty({ type: [AnswerDto], description: 'Array of answers' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
