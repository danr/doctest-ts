
export default class SomeClass {

    /**
     * Gets the field doubled
     * @example xyz
     *
     * import OtherClass from "./OtherClass";
     * 
     * // Should equal 42
     * SomeClass.get() // => 42
     *
     * SomeClass.get() + 1 // => 43
     * 
     * new OtherClass().doSomething(new SomeClass()) // => 5
     *
     * const abc = 42
     * SomeClass.get() // => abc
     * SomeClass.get() + 1 // => abc + 1
     * 
     */
    private static get() : number{
        // a comment
        // @ts-ignore
        return 42
    }
    
    public xyz(){
        return 5
    }

}