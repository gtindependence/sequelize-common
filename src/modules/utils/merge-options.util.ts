import { FindAndCountOptions, FindOptions, IncludeOptions, Order, Transaction, WhereOptions } from 'sequelize';
import { Op } from 'sequelize';
import { deepmergeCustom } from 'deepmerge-ts';

export type MergeableOptions = FindOptions | FindAndCountOptions | WhereOptions | IncludeOptions;

const keyedMerges: Record<string, (base: unknown, request: unknown) => unknown> = {
    include: (base, request) => includeMerge(base as IncludeOptions[], request as IncludeOptions[]),
    where: (base, request) => whereMerge(base as WhereOptions, request as WhereOptions),
    order: (base, request) => orderMerge(base as Order, request as Order)
};

const deepMerge = deepmergeCustom<unknown, object, { key: unknown }>({
    metaDataUpdater: (_previousMeta, { key }) => ({ key }),
    mergeArrays: (values, utils, meta) => {
        const keyedMerge = typeof meta?.key === 'string' ? keyedMerges[meta.key] : undefined;
        return keyedMerge && values.length === 2 ? keyedMerge(values[0], values[1]) : utils.defaultMergeFunctions.mergeArrays(values);
    },
    mergeRecords: (values, utils, meta) => {
        const keyedMerge = typeof meta?.key === 'string' ? keyedMerges[meta.key] : undefined;
        return keyedMerge && values.length === 2 ? keyedMerge(values[0], values[1]) : utils.defaultMergeFunctions.mergeRecords(values, utils, meta);
    }
});

const includeMerge = (baseIncludes: IncludeOptions[], requestIncludes: IncludeOptions[]) => {
    baseIncludes.forEach((baseInclude) => {
        let foundMatch = false;
        requestIncludes.forEach((requestInclude, index) => {
            if (baseInclude.model === requestInclude.model && baseInclude.as === requestInclude.as) {
                requestIncludes[index] = deepMerge(baseInclude, requestInclude) as IncludeOptions;
                foundMatch = true;
            }
        });
        if (!foundMatch) {
            requestIncludes.push(baseInclude);
        }
    });
    return requestIncludes;
};

const orderMerge = (baseOrder: Order, requestOrder: Order) => {
    if (Array.isArray(baseOrder) && Array.isArray(requestOrder)) {
        return [...requestOrder, ...baseOrder];
    } else {
        return requestOrder;
    }
};

const whereMerge = (baseWhere: WhereOptions, requestWhere: WhereOptions): WhereOptions => {
    return {
        [Op.and]: [baseWhere, requestWhere]
    };
};

const getTransaction = (baseOptions: FindOptions, requestOptions: FindOptions) => {
    let transaction;
    if (baseOptions.transaction !== undefined) {
        transaction = baseOptions.transaction;
        baseOptions.transaction = undefined;
    }
    if (requestOptions.transaction !== undefined) {
        transaction = requestOptions.transaction;
        requestOptions.transaction = undefined;
    }
    return transaction;
};

const attachTransaction = (mergedOptions: FindOptions, transaction: Transaction) => {
    mergedOptions.transaction = transaction;
};

const _mergeOptions = (baseOptions: FindOptions = {}, requestOptions: FindOptions = {}): FindOptions => {
    const transaction = getTransaction(baseOptions, requestOptions);
    const mergedOptions = deepMerge(baseOptions, requestOptions);
    attachTransaction(mergedOptions, transaction);
    return mergedOptions;
};

export const mergeOptions = (...options: FindOptions[]): FindOptions => {
    if (options.length === 0) {
        return {};
    } else {
        let findOptions = options[0];
        // merge all of the options together one by one
        for (let i = 1; i < options.length; i++) {
            findOptions = _mergeOptions(findOptions, options[i]);
        }
        return findOptions;
    }
};
