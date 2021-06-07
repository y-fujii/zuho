fn main() {
	let n = 32;
	for i in 0 .. n {
		let mut x = 1.0 / (2 * n) as f64;
		let mut p = 1.0;
		let mut j = i;
		while j != 0 {
			p *= 0.5;
			if j & 1 != 0 {
				x += p;
			}
			j >>= 1;
		}
		let y = (2 * i + 1) as f64 / (2 * n) as f64;
		println!("{:+} {:+}", x - 0.5, y - 0.5);
	}
}
