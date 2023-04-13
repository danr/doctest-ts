export default interface TestDescription {

    /**
     * The name of the module under test
     */
    moduleName?: string;

    /**
     * The name of the function under testing
     */
    functionName?: string

    /**
     * The name of the singular test
     */
    testName?: string
}