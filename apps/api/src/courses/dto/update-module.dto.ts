import { PartialType } from '@nestjs/mapped-types';
import { CreateModuleDto } from './create-module.dto';

/**
 * DTO for updating a course module
 * 
 * Requirements:
 * - R17: Support updating module properties
 * - R17.6: Allow reordering without changing other properties
 */
export class UpdateModuleDto extends PartialType(CreateModuleDto) {}
