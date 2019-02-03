
// STILL, reducers is broken completely
function OptionalReducersSolution() {
    type ExtractReducersShape<TModelDefinition> = TModelDefinition extends {reducers: infer TReducersInferred} ? TReducersInferred : never;

    interface ModelDefinition<TState, TExtractedReducers> {
        state: TState;
        reducers?: TReducers<TState, TExtractedReducers>;
    }

    type TReducers<TState, TExtractedReducers> = {
        [TReducerName in keyof TExtractedReducers]: TReducer<TState>
    }

    type TReducer<TState> = (state: TState, payload: any) => TState;
    type ExtractStateShape<TModelDefinition> = TModelDefinition extends {state: infer TStateInferred} ? TStateInferred : never;

    function createModel<TModelDefinition extends ModelDefinition<ExtractStateShape<TModelDefinition>,ExtractReducersShape<TModelDefinition>>>(modelDefinition: TModelDefinition): void {
    }
    /* tslint:disable:expect */
    createModel({
        state: "string",
        reducers: {
            setValueTo21: (oldState: number, payload: any) => 21
        }
    });
    /* tslint:enable:expect */
}