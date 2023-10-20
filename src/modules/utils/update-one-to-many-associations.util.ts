import * as moment from 'moment';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { UpdateOneToManyAssociationsOptions } from '../interfaces';
import { CreatedByEntity } from '../models';
import { AttributesOf } from '../types';
import { UpdateOptions } from 'sequelize';

export async function updateOneToManyAssociations<
    T extends CreatedByEntity<T>,
    AuthenticatedUserType extends AuthenticatedUser = AuthenticatedUser,
    NewChildrenType = any
>(options: UpdateOneToManyAssociationsOptions<T, AuthenticatedUserType, NewChildrenType>
) {
    const {
        currentChildren,
        newChildren,
        comparisonFunction,
        fillFunction,
        user,
        transaction,
        childTableModel,
    } = options;

    // Used to determine if we will actually delete items at the end
    const upsertOnly = !!options.upsertOnly;

    const relationIdsToDelete = new Set(
        currentChildren.map(currentChild => currentChild.id)
    );

    // promise array for all creates and deletes that will need to happen
    const updatePromises: Promise<T>[] = [];

    const recordsToCreate: AttributesOf<T>[] = [];

    // loop through the newChildren to create relation if necessary
    for (let i = 0; i < newChildren.length; i += 1) {
        const relationObjectIndex = comparisonFunction(currentChildren, newChildren[i]);

        // if they don't exist in the current relations, create new relation
        if (relationObjectIndex < 0) {
            const filledRecord = await fillFunction(newChildren[i], i, undefined, options);
            filledRecord.createdById = user.id;
            filledRecord.updatedById = user.id;
            recordsToCreate.push(filledRecord);
        }
        // if the newChild existed, then remove that index from the list to be deleted
        else {
            const relatedObject = currentChildren[relationObjectIndex];
            currentChildren.splice(relationObjectIndex, 1);
            relationIdsToDelete.delete(relatedObject.id);

            const filledRecord = await fillFunction(newChildren[i], i, relatedObject, options);
            filledRecord.updatedById = user.id;

            // if the record is being updated, ensure it is not deleted
            filledRecord.deletedAt = null;
            filledRecord.deletedById = null;

            // update sort order if necessary
            updatePromises.push(
                await relatedObject.update(filledRecord, { transaction }) as unknown as Promise<T>
            );
        }
    }
    const createPromise: Promise<T[]> = await childTableModel.bulkCreate(recordsToCreate as any, {
        returning: true,
        transaction
    }) as unknown as Promise<T[]>;

    // create an array of all the records to delete
    const idsToDelete: number[] = Array.from(relationIdsToDelete);

    // create a default promise that will return that 0 records were updated
    let deletePromise = new Promise<[number, T[]]>(resolve => resolve([0, []]));
    // delete those records
    if (idsToDelete.length > 0 && !upsertOnly) {
        deletePromise = await childTableModel.update({
            deletedById: user.id,
            deletedAt: moment.utc().toISOString()
        } as any, {
            where: {
                id: idsToDelete
            },
            returning: true,
            transaction
        } as UpdateOptions) as unknown as Promise<[number, T[]]>;
    }

    // resolve all promises
    const [
        createdRecords,
        updatedRecords,
        [, deletedRecords]
    ] = await Promise.all([
        createPromise,
        Promise.all(updatePromises),
        deletePromise
    ]);

    // return the result of the update
    return {
        createdRecords,
        updatedRecords,
        deletedRecords
    };
}
