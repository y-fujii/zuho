# zuho.js

zuho.js is a high-quality WebGL Equirectangular image viewer with many projection method.

[Demo](https://mimosa-pudica.net/zuho/)

## Features

- High-quality rendering.
	- Use QMC sampling to handle highly nonlinear anisotropy.
	- Pseudo gamma-corrected calculation.
	- Switch the two shaders (speed vs quality) adaptively.
- Support many projection methods.
	- Azimuthal | Perspective
	- Azimuthal | Conformal
	- Azimuthal | Equidistant
	- Azimuthal | Equiarea
	- Azimuthal | Orthogonal
	- Azimuthal | Reflect
	- Cylindrical | Perspective
	- Cylindrical | Conformal
	- Cylindrical | Equidistant
	- Cylindrical | Equiarea (= Orthogonal)
	- Mollweide
	- Hammer
	- Eckert IV
	- It is also very easy to add custom projection functions.  See
	  "Mapping" in "zuho.js".
- No dependencies, small, and easy to use.
	- Requires only "zuho.js", which is less than 600 SLoC.
	- Implemented as a custom element.
	- Provides simple rendering JS APIs.

## Usage

zuho.js provides a `x-zuho` custom element.

	<script type="module" src="zuho.js"></script>
	<x-zuho src="src.jpg"></x-zuho>

See "index.html" for more advanced usage.

zuho.js also provides JS API. Although it is not stable and not documented yet,
I think it is not difficult to use because zuho.js is a tiny library.

## Manipulation

- Rotate : Drag.
- Zoom : Wheel, shift key + drag, or pinch gesture.

## Browser Support

The latest Blink-based, Gecko-based, and WebKit-based browsers should be supported.

## TODO:

- Custom default rotation.
- 3 DoF rotation with two-finger operations.
- Read XMP metadata.

## Tips

"zuhô (図法)" is the Japanese word which means "map projection method".
