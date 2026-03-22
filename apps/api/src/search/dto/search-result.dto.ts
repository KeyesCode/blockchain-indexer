import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchResultDto {
  @ApiProperty({
    enum: ['transaction', 'block', 'token', 'address', 'none'],
    example: 'block',
  })
  type!: 'transaction' | 'block' | 'token' | 'address' | 'none';

  @ApiPropertyOptional({
    description: 'The matched entity, or null if type is "none"',
    nullable: true,
  })
  result!: any;
}
