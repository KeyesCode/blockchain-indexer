import { ApiProperty } from '@nestjs/swagger';
import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export class PaginatedDto<T> {
  items!: T[];

  @ApiProperty({ example: 150 })
  total!: number;

  @ApiProperty({ example: 25 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;
}

export function ApiPaginatedResponse(itemType: Type) {
  return applyDecorators(
    ApiExtraModels(PaginatedDto, itemType),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedDto) },
          {
            properties: {
              items: {
                type: 'array',
                items: { $ref: getSchemaPath(itemType) },
              },
            },
          },
        ],
      },
    }),
  );
}
