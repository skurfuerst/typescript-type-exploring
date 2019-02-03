// TypeScript Version: 3.2

/**
 * We want to expore the TypeScript Type System not based on small, theoretical
 * examples, but based on real-world applications. I have been working with
 * [Rematch](https://github.com/rematch/rematch) recently; but it turned out that
 * its TypeScript types could use some improvements. I want to use this as an example
 * as I explore typing.
 *
 * ## Guides to read beforehand
 *
 * This is not an "intro to TypeScript Typing"; we assume you have some rough
 * familiarity with TypeScript Generics, mapped types, and the `infer` keyword.
 * If you want to read more about them, I suggest the following resources:
 *
 * - [TypeScript official Handbook](https://www.typescriptlang.org/docs/handbook), especially
 *   the following chapters:
 *   - [Generic Constraints](https://www.typescriptlang.org/docs/handbook/generics.html#generic-constraints)
 *   - [Advanced Types](https://www.typescriptlang.org/docs/handbook/advanced-types.html)
 *   - [TS 2.1 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-1.html)
 *   - [TS 2.0 RN - the never type](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-0.html#the-never-type)
 *   - [TS 2.8 - conditional types](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-8.html)
 * - [baserat GitBook](https://basarat.gitbooks.io/typescript/docs/types/type-system.html)
 *
 * First, we want to focus on how you [define Models](https://github.com/rematch/rematch/blob/master/docs/recipes/typescript.md#autocomplete-dispatchmodels)
 * in rematch and improve that.
 *
 * ```
 *export const sharks = createModel({
 * state: 0,
 * reducers: {
 *     increment: (state: SharksState, payload: number): SharksState => state + payload,
 * },
 *effects: {
 *   // TODO: Optional args breaks TypeScript autocomplete (e.g. payload: number = 1)
 *  async incrementAsync(payload: number) {
 *    await delay(500);
 *    this.increment(payload || 1);
 *  },
 *},
 *});
 * ```
 */


/**
 * ## Chapter 1: use consistent state in reducers
 *
 * First, we want to focus on the `state` and the `reducers`: Every reducer
 * must receive a `state` parameter and return the new state.
 *
 * Naively, this is quite easy to type:
 */
function NaiveStateReducers() {
    // The model has a generic parameter `TState` which should match the state of the model.
    interface ModelDefinition<TState> {
        state: TState;
        reducers: TReducers<TState>;
    }
    // we support arbitrary reducers, but every one of them must adhere to the same state shape.
    interface TReducers<TState> {
        [reducerName: string]: TReducer<TState>;
    }
    // a reducer is a function taking the state as first parameter, and emitting a state.
    type TReducer<TState> = (state: TState, payload: any) => TState;

    function createModel<TState>(modelDefinition: ModelDefinition<TState>): void {
    }

    function examples() {
        // Now, let's start to play with the type definitions.

        // A minimal model can be built; without reducers.
        createModel({
            state: 42,
            reducers: {}
        });

        // A reducer which matches the types is all cool :)
        createModel({
            state: 42,
            reducers: {
                setValueTo21: (oldState: number, payload: any) => 21
            }
        });

        // BAD BEHAVIOR 1: In case the types do not match, the `state`
        // property highlights as problematic; and not the specific reducer!
        /* tslint:disable:expect */
        createModel({
            state: "string",
            reducers: {
                setValueTo21: (oldState: number, payload: any) => 21
            }
        });
        /* tslint:enable:expect */

        // In case we manually specify the generic type, the error returns
        // to the correct position where I'd expect it. However, manually
        // specifying generics is nothing the reader should be forced to do.
        /* tslint:disable:expect */
        createModel<string>({
            state: "string",
            reducers: {
                setValueTo21: (oldState: number, payload: any) => 21
            }
        });
        /* tslint:enable:expect */
    }
}

/**
 * OK. So we need to do something differently to show the error in the reducers.
 *
 * Let's first extract the shape of `state` using the `infer` keyword; then
 * we can *force* the reducer's type to be this way. Basically, in the code above
 * we just specified that *all occurences of `TState` should be the same*; so the
 * type checker can just tell us at an arbitrary location if it does not match.
 *
 * Now, we want to basically guide the type checker to run two steps after each other:
 * 1) determine the type of `state`.
 * 2) ensure the `reducers` use this state appropriately.
 */
function ExtractStateShapeFirstAndThenUseIt() {
    // the following three types are exactly the same as above. no change there.
    interface ModelDefinition<TState> {
        state: TState;
        reducers: TReducers<TState>;
    }
    interface TReducers<TState> {
        [reducerName: string]: TReducer<TState>;
    }
    type TReducer<TState> = (state: TState, payload: any) => TState;

    // HERE, the modification starts!
    // Let's define a helper type `ExtractStateShape` which does the following:
    // - the type gets passed in a generic type; and it returns the type of the `state` property
    //   of this generic type.
    // - In case the generic type does not have a `state` property, `never` is returned.
    //
    // After the definition, Let's play around with `ExtractStateShape`:
    type ExtractStateShape<TModelDefinition> = TModelDefinition extends {state: infer TStateInferred} ? TStateInferred : never;

    // $ExpectType never
    type stringDoesNotHaveStateProperty = ExtractStateShape<"a string">;
    // $ExpectType never
    type emptyObjectDoesNotHaveStateProperty = ExtractStateShape<{}>;
    // $ExpectType string
    type stateIsAString = ExtractStateShape<{state: string}>;
    // $ExpectType { stateKey1: string; }
    type stateIsAnObject = ExtractStateShape<{state: {stateKey1: string}}>;

    // **It is crucial to rember that we operate on TYPES, and not on individual objects.**
    //
    // What does this mean? Let's look at the example below, which contains the type for `createModel`:
    function createModel<TModelDefinition extends ModelDefinition<ExtractStateShape<TModelDefinition>>>(modelDefinition: TModelDefinition): void {
    }
    // This line is quite long - especially involving the generics. What is happening here?
    // We'll now dissect the generic part `<TModelDefinition extends ModelDefinition<ExtractStateShape<TModelDefinition>>`:
    // ```
    // <TModelDefinition extends
    //   ModelDefinition<
    //      ExtractStateShape<TModelDefinition>
    //   >
    // >
    // ```
    //
    // This says: "the generic type parameter `TModelDefinition` should be of the form `ModelDefinition<...>`."
    // As `TModelDefinition` is used as parameter type for `modelDefinition`, this ensures that the
    // function parameter is of the type `ModelDefinition<...>`. So far, this is *exactly* what we expressed
    // in the simple example above.
    //
    // Now comes the magic: As our `TState`, we are using our just-created helper `ExtractStateShape<TModelDefinition>`,
    // and this helper **can get the model definition we're just typing as input**.
    //
    // Let me re-phrase it differently:
    // - We want to specify the exact type for TModelDefinition, by saying "it is a `ModelDefinition` with some state shape."
    // - To extract the state shape, we use an `ExtractStateShape` helper, which looks at the *actual* `TModelDefinition` shape,
    //   (i.e. the parameter `modelDefinition` passed into the function) and extracts the *actual* shape of the `state` property.
    //
    // Sidenote: Types in TypeScript are just aliases, so I can also inline the `ExtractStateShape` helper into the `createModel`
    //           expression; but this leads to quite an unreadable long statement; so I would not recommend it:
    function createModel2<TModelDefinition extends ModelDefinition<TModelDefinition extends {state: infer TStateInferred} ? TStateInferred : never>>(modelDefinition: TModelDefinition): void {
    }
    // So what the Type Checker actually *appears to be doing* is:
    //
    // - start to bind the actual shape of modelDefinition to the generic type parameter `TModelDefinition`
    // - resolve the `ExtractStateShape<TModelDefinition>` part, inferring the type of the state.
    // - use this result as the type parameter of `ModelDefinition`; and start checking whether the types
    //   match at all places.
    //   - unsurprisingly, the `state` property matches. (After all, we just extracted it from there :-))
    //   - every reducer's `state` parameter (and its output) now must match the `state` shape.
    // - Thus, if state and reducer types do not match, the *reducer is highlighted with an error*.
    //
    // This is the behavior we want, as the following examples demonstrate!

    // The success cases still work:
    createModel({
        state: 42,
        reducers: {
            setValueTo21: (oldState: number, payload: any) => 21
        }
    });

    // The advanced case now correctly shows the error on the reducer; not on the state.
    /* tslint:disable:expect */
    createModel({
        state: "string",
        reducers: {
            setValueTo21: (oldState: number, payload: any) => 21
        }
    });
    /* tslint:enable:expect */

    // TODO: now it is not possible anymore to specify the state using a generic type parameter;
    // i.e. saying "createModel<TState>". I have not been able to do this yet.

    // TODO: any behavior??
}

/**
 * Optional Reducers
 */
function OptionalReducersProblem() {
    // the following types are exactly as the ones above, with the only change being reducers are optional now.
    interface ModelDefinition<TState> {
        state: TState;
        reducers?: TReducers<TState>;
    }
    interface TReducers<TState> {
        [reducerName: string]: TReducer<TState>;
    }
    type TReducer<TState> = (state: TState, payload: any) => TState;
    type ExtractStateShape<TModelDefinition> = TModelDefinition extends {state: infer TStateInferred} ? TStateInferred : never;
    function createModel<TModelDefinition extends ModelDefinition<ExtractStateShape<TModelDefinition>>>(modelDefinition: TModelDefinition): void {
    }

    // Now in this case, something a little bad is happening: a single reducer is wrong, but
    // the full `reducers` array is shown as invalid.
    // When inspecting the error message, it can be seen that `setValueTo21` is the problem; but
    // still it would be good to find an alternative which works better.
    /* tslint:disable:expect */
    createModel({
        state: "string",
        reducers: {
            setValueTo21: (oldState: number, payload: any) => 21
        }
    });
    /* tslint:enable:expect */
}

/**
 * ALTERNATIVE way of extracting the state shape, without using `infer`.
 *
 * I've just found an alternative way to extract the state shape; so instead of `ExtractStateShape<TModelDefinition>`
 * we can just use `TModelDefinition["state"]` instead. That's quite neat IMHO, as it makes the code more readable.
 */
function AlternativeWayOfExtractingStateShape() {
    // the following types are exactly as the ones above
    interface ModelDefinition<TState> {
        state: TState;
        reducers?: TReducers<TState>;
    }
    interface TReducers<TState> {
        [reducerName: string]: TReducer<TState>;
    }
    type TReducer<TState> = (state: TState, payload: any) => TState;
    // Only modification here
    function createModel<TModelDefinition extends ModelDefinition<TModelDefinition['state']>>(modelDefinition: TModelDefinition): void {
    }

    // This has exactly the same behavior as the last model; just a little easier to read on the type side.
    /* tslint:disable:expect */
    createModel({
        state: "string",
        reducers: {
            setValueTo21: (oldState: number, payload: any) => 21
        }
    });
    /* tslint:enable:expect */
}

function foobar() {
    interface ModelDefinition<TState> {
        state: TState;
        reducers: TReducers<TState>;
    }
    interface TReducers<TState> {
        [reducerName: string]: TReducer<TState>;
    }
    type TReducer<TState> = (state: TState, payload: any) => TState;
    function createModel<TModelDefinition extends ModelDefinition<TModelDefinition["state"]>>(modelDefinition: TModelDefinition): void {
    }

    function effects() {
    }
    createModel({
        state: 42,
        reducers: {
            setValueTo21: (oldState: number, payload: any) => 21
        },
        effects
    });


    /* tslint:disable:expect */
    // WTF??? Why does this break state type inferrence?
    createModel({
        state: 42,
        reducers: {
            setValueTo21: (oldState: number, payload: any) => 21
        },
        foo: {
            foo() {
            }
        }
    });
    /* tslint:enable:expect */

    // TODO: now it is not possible anymore to specify the state using a generic type parameter;
    // i.e. saying "createModel<TState>". I have not been able to do this yet.

    // TODO: any behavior??
}