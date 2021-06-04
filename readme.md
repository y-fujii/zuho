# zuho.js - WebGL equirectangular image viewer

## Demo

[Demo](https://mimosa-pudica.net/zuho/)

## Features

- Rendering quality.
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
	- Cylindrical | Equiarea
	- Mollweide
	- Hammer
	- Eckert IV
	- It is also very easy to add custom projection functions.  See
	  "Mapping" in "zuho.js".
- No dependencies, small, and easy to use.
	- Requires only "zuho.js", which is less than 600 SLoC.

## Usage

	<script type="module" src="zuho.js"></script>
	<x-zuho src="src.jpg" mapping="azConformal" style="width: 720px; height: 480px"></x-zuho>

See "index.html" for example and "zuho.js" for a detailed usage.

Although JS API is not stable and not documented yet, it is easy to use because
zuho.js is a tiny library.

## Manipulation

- Rotate : Left drag.
- Zoom : Wheel or Shift + mouse left drag.

## TODO:

- Custom default rotation.
- 3 DoF rotation with two-finger operations.
- Read XMP metadata.

## Tips

"zuhô (図法)" is the Japanese word which means "map projection method".
