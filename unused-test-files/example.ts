
/** I */
export interface I {
  /** k */
  k: number
}

/** H */
interface H {
  /** k */
  k: number
}

/** C */
export class C {
  /** f */
  f = 1
  /** g */
  g: number
  /** new */
  constructor(x: number) { this.g = x }
  /** s */
  static s(y: number): I { return {k: y} }
  /** m */
  m(z: number): I { return {k: z} }
}

/** T */
type T = C

/** c */
const c = new C(1)

/** M */
export module M {
  /** MI */
  export interface MI {
    /** M k */
    k: number
  }

  /** MC */
  export class MC {
    /** M f */
    f = 1
    /** M g */
    g: number
    /** M new */
    constructor(x: number) { this.g = x }
    /** M s */
    static s(y: number): MI { return {k: y} }
    /** M m */
    m(z: number): MI { return {k: z} }

    /** M p */
    private p(z: number): MI { return {k: z} }
  }

  type MT = MC

  export const c = new MC(1)
}

/** HM */
module HM {
  /** HMI */
  interface HMI {
    /** HM k */
    k: number
  }

  /** HMC */
  class HMC {
    /** HM f */
    f = 1
    /** HM g */
    g: number
    /** HM new */
    constructor(x: number) { this.g = x }
    /** HM s */
    static s(y: number): HMI { return {k: y} }
    /** HM m */
    m(z: number): HMI { return {k: z} }
  }

  type HMT = HMC

  const c = new HMC(1)
}
