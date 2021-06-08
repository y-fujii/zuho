// (c) Yasuhiro Fujii <y-fujii at mimosa-pudica.net>, under MIT License.

// ref. "Walsh Series Analysis of the L2-Discrepancy of Symmetrisized Point Sets",
//      by G. Larcher and F. Pillichshammer.

// TODO: it is better to be symmetrized?
// TODO: the paper introduces a large class of LDS.  is a[i, j] = 1 the best set?

fn generate(n: u32, matrix: impl Fn(u32) -> u32) -> f64 {
    let mut x = 0u32;
    for i in 0..32 {
        if n & (1 << i) != 0 {
            x ^= matrix(31 - i);
        }
    }
    x as f64 / (1u64 << 32) as f64
}

fn main() {
    //let matrix = |i| 1u32 << i; // van der Corput with base 2.
    let matrix = |i| !0u32 << i; // Larcher Pillichshammer with a[i, j] = 1.
    let n = 32;

    let offset = (1 - n) as f64 / (2 * n) as f64;
    for i in 0..n {
        let x = generate(i as u32, matrix);
        let y = i as f64 / n as f64;
        println!("({:+}, {:+})", x + offset, y + offset);
    }
}
