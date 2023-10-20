import { AttributesOf } from './attributes-of.type';
import { UpdateManyToManyAssociationsOptions, UpdateOneToManyAssociationsOptions } from '../interfaces';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { CreatedByEntity } from '../models';
import { JoinTableEntity } from '../models';

export type UpdateAssociationFillFunction<
    T extends JoinTableEntity | CreatedByEntity<T>,
    AuthenticatedUserType extends AuthenticatedUser = AuthenticatedUser,
    NewChildrenType = any>
    = (newChild: NewChildrenType, index: number, existingRecord: T, updateOptions:
        UpdateManyToManyAssociationsOptions<T, AuthenticatedUserType, NewChildrenType> |
        UpdateOneToManyAssociationsOptions<T, AuthenticatedUserType, NewChildrenType>) => AttributesOf<T> | Promise<AttributesOf<T>>;
