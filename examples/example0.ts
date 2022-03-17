

export default class Example0 {
    
    /**
     * Gets the field doubled
     * @example xyz
     * 
     * // Should equal 42
     * Example0.get() // => 42
     * 
     * Example0.get() + 1 // => 43
     */
    private static get(){
        // a comment
        // @ts-ignore
        return 42
    }
    
    public testMore(){
        return ({} as any) ?.xyz?.abc ?? 0
    }
    
}