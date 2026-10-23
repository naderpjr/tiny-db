const getValue = (doc, path) => path.split('.').reduce((o, k) => o?.[k], doc);

const isOperators = (cond) =>
    cond !== null && typeof cond === 'object' && !Array.isArray(cond);

const operators = {
    $gt: (v, a) => v > a,
    $gte: (v, a) => v >= a,
    $lt: (v, a) => v < a,
    $lte: (v, a) => v <= a,
    $ne: (v, a) => v !== a,
    $in: (v, a) => a.includes(v),
};


export function matches(doc, query) {
    return Object.entries(query).every(([field, cond]) => {
        const value = getValue(doc, field);
        if (isOperators(cond)) {
            return Object.entries(cond).every(([op, arg]) => {
                if (!operators[op]) throw new Error(`Unknown operator ${op}`);
                return operators[op](value, arg);
            });
        }
        return value === cond; 
    });
}


export function applyPatch(doc, patch) {
    const out = { ...doc };
    for (const [key, val] of Object.entries(patch)) {
        if (key === '$inc') {
            for (const [f, n] of Object.entries(val)) out[f] = (out[f] ?? 0) + n;
        } else if (key !== '_id') {
            out[key] = val;
        }
    }
    return out;
}