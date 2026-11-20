import { FindOptions, Includeable, IncludeOptions, Model, Op, Transaction } from 'sequelize';
import { mergeOptions } from './merge-options.util';

// Stand-ins for Sequelize models; includes are matched by reference on `model`
class ModelA extends Model {}
class ModelB extends Model {}

// Transactions are only passed through by reference, so a stand-in object is enough
const fakeTransaction = (id: string) => ({ id, commit: jest.fn() }) as unknown as Transaction;

const includesOf = (options: { include?: Includeable | Includeable[] }) => options.include as IncludeOptions[];

describe('mergeOptions', () => {
    it('returns an empty object when given no options', () => {
        expect(mergeOptions()).toEqual({});
    });

    it('returns the single options object when given one', () => {
        const options: FindOptions = { attributes: ['id'] };
        expect(mergeOptions(options)).toEqual({ attributes: ['id'] });
    });

    describe('updateManyToManyAssociations usage (base options merged with {})', () => {
        it('keeps attributes and where unchanged', () => {
            const base: FindOptions = { attributes: ['id', 'name'], where: { parentId: 5 } };
            expect(mergeOptions(base, {})).toEqual({ attributes: ['id', 'name'], where: { parentId: 5 } });
        });

        it('does not wrap where in Op.and when only one side has it', () => {
            const merged = mergeOptions({ where: { parentId: 5 } }, {});
            expect(merged.where).toEqual({ parentId: 5 });
            expect((merged.where as Record<symbol, unknown>)[Op.and]).toBeUndefined();
        });

        it('preserves non-plain values such as Date and Buffer in where', () => {
            const date = new Date('2020-01-01');
            const buffer = Buffer.from('abc');
            const merged = mergeOptions({ where: { createdAt: date, key: buffer } }, {});
            expect(merged.where).toEqual({ createdAt: date, key: buffer });
        });
    });

    describe('where', () => {
        it('combines both sides with Op.and, base first', () => {
            const merged = mergeOptions({ where: { a: 1 } }, { where: { b: 2 } });
            expect(merged.where).toEqual({ [Op.and]: [{ a: 1 }, { b: 2 }] });
        });

        it('keeps the where from the request when the base has none', () => {
            const merged = mergeOptions({}, { where: { b: 2 } });
            expect(merged.where).toEqual({ b: 2 });
        });
    });

    describe('order', () => {
        it('puts request order before base order', () => {
            const merged = mergeOptions({ order: [['id', 'ASC']] }, { order: [['name', 'DESC']] });
            expect(merged.order).toEqual([['name', 'DESC'], ['id', 'ASC']]);
        });

        it('keeps the order when only one side has it', () => {
            expect(mergeOptions({ order: [['id', 'ASC']] }, {}).order).toEqual([['id', 'ASC']]);
            expect(mergeOptions({}, { order: [['id', 'ASC']] }).order).toEqual([['id', 'ASC']]);
        });
    });

    describe('arrays', () => {
        it('concatenates other arrays, base first', () => {
            const merged = mergeOptions({ attributes: ['id'] }, { attributes: ['name'] });
            expect(merged.attributes).toEqual(['id', 'name']);
        });
    });

    describe('include', () => {
        it('appends base includes that are not in the request', () => {
            const baseInclude: IncludeOptions = { model: ModelA, as: 'a' };
            const requestInclude: IncludeOptions = { model: ModelB, as: 'b' };
            const merged = mergeOptions({ include: [baseInclude] }, { include: [requestInclude] });
            expect(merged.include).toEqual([requestInclude, baseInclude]);
        });

        it('merges includes with the same model and alias', () => {
            const merged = mergeOptions(
                { include: [{ model: ModelA, as: 'a', attributes: ['id'], where: { x: 1 } }] },
                { include: [{ model: ModelA, as: 'a', attributes: ['name'], where: { y: 2 } }] }
            );
            const includes = includesOf(merged);
            expect(includes).toHaveLength(1);
            expect(includes[0].model).toBe(ModelA);
            expect(includes[0].as).toBe('a');
            expect(includes[0].attributes).toEqual(['id', 'name']);
            expect(includes[0].where).toEqual({ [Op.and]: [{ x: 1 }, { y: 2 }] });
        });

        it('does not merge includes with the same model but a different alias', () => {
            const merged = mergeOptions(
                { include: [{ model: ModelA, as: 'a1' }] },
                { include: [{ model: ModelA, as: 'a2' }] }
            );
            expect(includesOf(merged)).toHaveLength(2);
        });

        it('merges nested includes recursively', () => {
            const merged = mergeOptions(
                { include: [{ model: ModelA, as: 'a', include: [{ model: ModelB, as: 'b', attributes: ['id'] }] }] },
                { include: [{ model: ModelA, as: 'a', include: [{ model: ModelB, as: 'b', attributes: ['name'] }] }] }
            );
            const nestedIncludes = includesOf(includesOf(merged)[0]);
            expect(nestedIncludes).toHaveLength(1);
            expect(nestedIncludes[0].attributes).toEqual(['id', 'name']);
        });
    });

    describe('transaction', () => {
        it('preserves the transaction by reference', () => {
            const transaction = fakeTransaction('tx');
            const merged = mergeOptions({ where: { a: 1 } }, { transaction });
            expect(merged.transaction).toBe(transaction);
        });

        it('prefers the request transaction over the base transaction', () => {
            const baseTransaction = fakeTransaction('base');
            const requestTransaction = fakeTransaction('request');
            const merged = mergeOptions({ transaction: baseTransaction }, { transaction: requestTransaction });
            expect(merged.transaction).toBe(requestTransaction);
        });

        it('falls back to the base transaction when the request has none', () => {
            const baseTransaction = fakeTransaction('base');
            const merged = mergeOptions({ transaction: baseTransaction }, {});
            expect(merged.transaction).toBe(baseTransaction);
        });
    });

    describe('multiple option sets', () => {
        it('merges all of them left to right', () => {
            const merged = mergeOptions({ where: { a: 1 } }, { where: { b: 2 } }, { where: { c: 3 } });
            expect(merged.where).toEqual({ [Op.and]: [{ [Op.and]: [{ a: 1 }, { b: 2 }] }, { c: 3 }] });
        });
    });

    describe('input mutation (current behavior)', () => {
        it('does not alter the where objects of the inputs', () => {
            const base: FindOptions = { where: { a: 1 } };
            const request: FindOptions = { where: { b: 2 } };
            mergeOptions(base, request);
            expect(base).toEqual({ where: { a: 1 } });
            expect(request).toEqual({ where: { b: 2 } });
        });
    });
});
