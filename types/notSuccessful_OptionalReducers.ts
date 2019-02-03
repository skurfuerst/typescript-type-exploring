/**
 * In this experiment, I tried using mapped types; to push down the errors on individual `reducers`.
 *
 * However, this did not work out - it's exactly the same behavior as `reducers` being defined as excess properties.
 */
function OptionalReducersSolution_notWorking() {
    type ExtractReducersShape<TModelDefinition> = TModelDefinition extends {reducers: infer TReducersInferred} ? TReducersInferred : never;

    interface ModelDefinition<TState, TExtractedReducers> {
        state: TState;
        reducers?: TReducers<TState, TExtractedReducers>;
    }

    type TReducers<TState, TExtractedReducers> = {
        [TReducerName in keyof TExtractedReducers]: TReducer<TState>
    };

    type TReducer<TState> = (state: TState, payload: any) => TState;
    function createModel<TModelDefinition extends ModelDefinition<TModelDefinition["state"], TModelDefinition["reducers"]>>(modelDefinition: TModelDefinition): void {
    }
    /* tslint:disable:expect */
    createModel({
        state: "string",
        reducers: { // TYPE-ERROR HERE!
            setValueTo21: (oldState: number, payload: any) => 21
        }
    });
    /* tslint:enable:expect */
}