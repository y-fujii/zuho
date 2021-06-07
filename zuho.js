// (c) Yasuhiro Fujii <y-fujii at mimosa-pudica.net>, under MIT License.

function square( x ) {
	return x * x;
}

class Matrix {
	static mul( n, x, y ) {
		console.assert( x.length == n * n && y.length == n * n );
		const z = new Float32Array( n * n );
		for( let i = 0; i < n; ++i ) {
			for( let j = 0; j < n; ++j ) {
				let sum = 0.0;
				for( let k = 0; k < n; ++k ) {
					sum += x[i * n + k] * y[k * n + j];
				}
				z[i * n + j] = sum;
			}
		}
		return z;
	}

	static identity( n ) {
		const z = new Float32Array( n * n );
		z.fill( 0.0 );
		for( let i = 0; i < n; ++i ) {
			z[i * n + i] = 1.0;
		}
		return z;
	}

	static rotation( n, i, j, arg ) {
		console.assert( i < n && j < n );
		const z = this.identity( n );
		const cos = Math.cos( arg );
		const sin = Math.sin( arg );
		z[i * n + i] = +cos;
		z[i * n + j] = -sin;
		z[j * n + i] = +sin;
		z[j * n + j] = +cos;
		return z;
	}
}

export class Renderer {
	constructor( canvas ) {
		const params = {
			alpha: true,
			depth: false,
			stencil: false,
			antialias: false,
			premultipliedAlpha: true,
		};
		const gl = this._gl =
			canvas.getContext( "webgl", params ) ||
			canvas.getContext( "experimental-webgl", params );

		this._vertShader     = gl.createShader( gl.VERTEX_SHADER );
		this._fragShaderFast = gl.createShader( gl.FRAGMENT_SHADER );
		this._fragShaderSlow = gl.createShader( gl.FRAGMENT_SHADER );
		this._progFast       = gl.createProgram();
		this._progSlow       = gl.createProgram();
		this._compile( this._vertShader, Renderer._vertSource );
		gl.attachShader( this._progFast, this._vertShader );
		gl.attachShader( this._progFast, this._fragShaderFast );
		gl.attachShader( this._progSlow, this._vertShader );
		gl.attachShader( this._progSlow, this._fragShaderSlow );
		this.setMapping( Mapping.azConformal );
		this.setCamera( Matrix.identity( 3 ), 1.0 );

		this._vbo = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this._vbo );
		gl.bufferData( gl.ARRAY_BUFFER, Renderer._vertices, gl.STATIC_DRAW );

		this._tex = gl.createTexture();
		gl.bindTexture( gl.TEXTURE_2D, this._tex );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );

		gl.bindTexture( gl.TEXTURE_2D, null );
		gl.bindBuffer( gl.ARRAY_BUFFER, null );
	}

	setImage( img ) {
		const gl = this._gl;
		gl.bindTexture( gl.TEXTURE_2D, this._tex );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img );
		gl.bindTexture( gl.TEXTURE_2D, null );
	}

	setMapping( code ) {
		this._compile( this._fragShaderFast, Renderer._fragSourceCommon + Renderer._fragSourceFast + code );
		this._compile( this._fragShaderSlow, Renderer._fragSourceCommon + Renderer._fragSourceSlow + code );
		this._link( this._progFast );
		this._link( this._progSlow );
	}

	setCamera( rot, scale ) {
		this._rotation = rot;
		this._scale    = scale;
	}

	render( fast ) {
		const gl = this._gl;

		gl.viewport( 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight );
		gl.disable( gl.BLEND );

		const prog = fast ? this._progFast : this._progSlow;
		gl.useProgram( prog );
		const f = this._scale / Math.sqrt( gl.drawingBufferWidth * gl.drawingBufferHeight );
		const sx = f * gl.drawingBufferWidth;
		const sy = f * gl.drawingBufferHeight;
		gl.uniformMatrix3fv( gl.getUniformLocation( prog, "uRot"    ), false, this._rotation );
		gl.uniform2f       ( gl.getUniformLocation( prog, "uScale"  ),        sx, sy         );
		gl.uniform1f       ( gl.getUniformLocation( prog, "uPxSize" ),        2.0 * f        );

		gl.enableVertexAttribArray( 0 );
		gl.bindBuffer( gl.ARRAY_BUFFER, this._vbo );
		gl.vertexAttribPointer( 0, 2, gl.FLOAT, false, 0, 0 );

		gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, this._tex );
		gl.uniform1i( gl.getUniformLocation( prog, "uTex" ), 0 );

		gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

		gl.bindTexture( gl.TEXTURE_2D, null );
		gl.bindBuffer( gl.ARRAY_BUFFER, null );
		gl.useProgram( null );
	}

	_compile( shader, src ) {
		const gl = this._gl;
		gl.shaderSource( shader, src );
		gl.compileShader( shader );
		const log = gl.getShaderInfoLog( shader );
		if( log.length > 0 ) {
			console.log( log );
		}
	}

	_link( prog ) {
		const gl = this._gl;
		gl.linkProgram( prog );
		const log = gl.getProgramInfoLog( prog );
		if( log.length > 0 ) {
			console.log( log );
		}
	}
}

Renderer._vertices = new Float32Array( [
	-1.0, -1.0, +1.0, -1.0, -1.0, +1.0, +1.0, +1.0,
] );

Renderer._fragSourceCommon = String.raw`
	#ifdef GL_FRAGMENT_PRECISION_HIGH
		precision highp   float;
	#else
		precision mediump float;
	#endif

	const   float     pi = 3.14159265359;
	uniform float     uPxSize;
	uniform mat3      uRot;
	uniform sampler2D uTex;
	varying vec2      vPos;

	bool unproject( vec2, out vec3 );

	vec4 sample( vec2 dp ) {
		vec2 p = vPos + uPxSize * dp;
		vec3 q;
		if( unproject( p, q ) ) {
			vec3 dir = normalize( uRot * q );
			float u = (0.5 / pi) * atan( dir[1], dir[0] ) + 0.5;
			float v = (1.0 / pi) * acos( dir[2] );
			return texture2D( uTex, vec2( u, v ) );
		}
		else {
			return vec4( 0.0 );
		}
	}
`;

Renderer._fragSourceFast = String.raw`
	void main() {
		gl_FragColor = sample( vec2( 0.0 ) );
	}
`;

Renderer._fragSourceSlow = String.raw`
	vec4 ss( float dx, float dy ) {
		vec4 s = sample( vec2( dx, dy ) );
		return vec4( s.xyz * s.xyz, s.w );
	}

	void main() {
		// sample with Hammersley set and sum pairwisely.
		// note that the float precision may be low and the number of registers is limited to 32 on mobile GPU.
		vec4 acc = (1.0 / 32.0) * (
			(((ss( -0.484375, -0.484375 ) + ss( +0.015625, -0.453125 ) + ss( -0.234375, -0.421875 ) + ss( +0.265625, -0.390625 )) +
			  (ss( -0.359375, -0.359375 ) + ss( +0.140625, -0.328125 ) + ss( -0.109375, -0.296875 ) + ss( +0.390625, -0.265625 ))) +
			 ((ss( -0.421875, -0.234375 ) + ss( +0.078125, -0.203125 ) + ss( -0.171875, -0.171875 ) + ss( +0.328125, -0.140625 )) +
			  (ss( -0.296875, -0.109375 ) + ss( +0.203125, -0.078125 ) + ss( -0.046875, -0.046875 ) + ss( +0.453125, -0.015625 )))) +
			(((ss( -0.453125, +0.015625 ) + ss( +0.046875, +0.046875 ) + ss( -0.203125, +0.078125 ) + ss( +0.296875, +0.109375 )) +
			  (ss( -0.328125, +0.140625 ) + ss( +0.171875, +0.171875 ) + ss( -0.078125, +0.203125 ) + ss( +0.421875, +0.234375 ))) +
			 ((ss( -0.390625, +0.265625 ) + ss( +0.109375, +0.296875 ) + ss( -0.140625, +0.328125 ) + ss( +0.359375, +0.359375 )) +
			  (ss( -0.265625, +0.390625 ) + ss( +0.234375, +0.421875 ) + ss( -0.015625, +0.453125 ) + ss( +0.484375, +0.484375 ))))
		);
		gl_FragColor = vec4( sqrt( acc.xyz ), acc.w );
	}
`;

Renderer._vertSource = String.raw`
	uniform   vec2 uScale;
	attribute vec2 aPos;
	varying   vec2 vPos;

	void main() {
		gl_Position = vec4( aPos, 0.0, 1.0 );
		vPos = uScale * aPos;
	}
`;

export const Mapping = {
	azPerspective: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			q = vec3( p, -1.0 );
			return true;
		}
	`,
	azConformal: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float t = dot( p, p );
			q = vec3( p, 0.25 * t - 1.0 );
			return true;
		}
	`,
	azEquidistant: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float r = length( p );
			q = vec3( p, -r / tan( r ) );
			return r < pi;
		}
	`,
	azEquiarea: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float t = dot( p, p );
			q = vec3( p, (t - 2.0) * inversesqrt( 4.0 - t ) );
			return t < 4.0;
		}
	`,
	azOrthogonal: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float t = dot( p, p );
			q = vec3( p * inversesqrt( 1.0 - t ), -1.0 );
			return t < 1.0;
		}
	`,
	azReflect: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float t = dot( p, p );
			q = vec3( p, inversesqrt( 1.0 - t ) - 2.0 );
			return t < 1.0;
		}
	`,
	cyPerspective: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float t = p.y;
			q = vec3( sin( p.x ), t, -cos( p.x ) );
			return abs( p.x ) < pi;
		}
	`,
	cyConformal: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float t = 0.5 * (exp( +p.y ) - exp( -p.y ));
			q = vec3( sin( p.x ), t, -cos( p.x ) );
			return abs( p.x ) < pi;
		}
	`,
	cyEquidistant: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float t = tan( p.y );
			q = vec3( sin( p.x ), t, -cos( p.x ) );
			return abs( p.x ) < pi && abs( p.y ) < pi / 2.0;
		}
	`,
	cyEquiarea: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float t = p.y * inversesqrt( 1.0 - p.y * p.y );
			q = vec3( sin( p.x ), t, -cos( p.x ) );
			return abs( p.x ) < pi && abs( p.y ) < 1.0;
		}
	`,
	mollweide: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float theta = asin( sqrt( 1.0 / 2.0 ) * p.y );
			float sinPhi = (1.0 / pi) * (2.0 * theta + sin( 2.0 * theta ));
			float cosPhi = sqrt( 1.0 - sinPhi * sinPhi );
			float lambda = (pi / sqrt( 8.0 )) * p.x / cos( theta );
			q = vec3(
				cosPhi * +sin( lambda ),
				sinPhi,
				cosPhi * -cos( lambda )
			);
			return abs( sinPhi ) < 1.0 && abs( lambda ) < pi;
		}
	`,
	hammer: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float t = dot( vec2( 0.25, 0.5 ) * p, vec2( 0.25, 0.5 ) * p );
			float z = sqrt( 1.0 - t );
			float sinPhi = z * p.y;
			float cosPhi = sqrt( 1.0 - sinPhi * sinPhi );
			float a = z * p.x / (4.0 * z * z - 2.0);
			q = vec3(
				cosPhi * (a * 2.0),
				sinPhi * (a * a + 1.0),
				cosPhi * (a * a - 1.0)
			);
			return t < 0.5;
		}
	`,
	eckert4: String.raw`
		bool unproject( vec2 p, out vec3 q ) {
			float sinTheta = sqrt( (4.0 + pi) / (4.0 * pi) ) * p.y;
			float cosTheta = sqrt( 1.0 - sinTheta * sinTheta );
			float sinPhi = (2.0 / (4.0 + pi)) * (asin( sinTheta ) + sinTheta * cosTheta + 2.0 * sinTheta);
			float cosPhi = sqrt( 1.0 - sinPhi * sinPhi );
			float lambda = (sqrt( 4.0 * pi + pi * pi ) / 2.0) * p.x / (1.0 + cosTheta);
			q = vec3(
				cosPhi * +sin( lambda ),
				sinPhi,
				cosPhi * -cos( lambda )
			);
			return abs( sinPhi ) < 1.0 && abs( lambda ) < pi;
		}
	`,
};

export class Handler {
	constructor( elem, renderer ) {
		this._element  = elem;
		this._renderer = renderer;
		this._pointers = new Map();
		this._theta    = Math.PI / -2.0;
		this._phi      = 0.0;
		this._scale    = 1.0;
		this._timer    = null;
		elem.style.touchAction = "none"; // XXX
		elem.addEventListener( "pointerdown",   this._onPointerDown.bind( this ) );
		elem.addEventListener( "pointerup",     this._onPointerUp  .bind( this ) );
		elem.addEventListener( "pointercancel", this._onPointerUp  .bind( this ) );
		elem.addEventListener( "pointermove",   this._onPointerMove.bind( this ) );
		elem.addEventListener( "wheel",         this._onWheel      .bind( this ) );
		new ResizeObserver( this._onResize.bind( this ) ).observe( elem );
		this._onResize( null );
	}

	_update( fast ) {
		const rot = Matrix.mul( 3,
			Matrix.rotation( 3, 1, 2, this._theta ),
			Matrix.rotation( 3, 0, 1, this._phi   )
		);
		this._renderer.setCamera( rot, this._scale );
		this._renderer.render( fast );
	}

	_updateDelayed() {
		clearTimeout( this._timer );
		this._update( true );
		this._timer = setTimeout( this._onTimer.bind( this ), 250 );
	}

	_pointerInfo() {
		const n = this._pointers.size;
		if( n < 1 ) {
			return { x: null, y: null, v: null };
		}

		// calculate mean.
		let xs = 0.0;
		let ys = 0.0;
		for( const ev of this._pointers.values() ) {
			xs += ev.clientX;
			ys += ev.clientY;
		}
		const xm = xs / n;
		const ym = ys / n;

		if( n < 2 ) {
			return { x: xm, y: ym, v: null };
		}

		// calculate variance.
		let s2 = 0.0;
		for( const ev of this._pointers.values() ) {
			s2 += square( ev.clientX - xm ) + square( ev.clientY - ym );
		}
		const v = s2 / (n - 1);

		return { x: xm, y: ym, v: v };
	}

	_onTimer( ev ) {
		this._update( false );
	}

	_onPointerDown( ev ) {
		this._element.setPointerCapture( ev.pointerId );
		this._pointers.set( ev.pointerId, ev );
	}

	_onPointerUp( ev ) {
		this._element.releasePointerCapture( ev.pointerId );
		this._pointers.delete( ev.pointerId );
		this._update( false );
	}

	_onPointerMove( ev ) {
		const prev = this._pointerInfo();
		if( this._pointers.has( ev.pointerId ) ) {
			this._pointers.set( ev.pointerId, ev );
		}
		const curr = this._pointerInfo();

		if( prev.x === null || curr.x === null ) {
			return;
		}

		const rect = this._element.getBoundingClientRect();
		if( ev.shiftKey ) {
			const centerX = (rect.left + rect.right) / 2.0;
			const centerY = (rect.top + rect.bottom) / 2.0;
			const prevR = square( prev.x - centerX ) + square( prev.y - centerY );
			const currR = square( curr.x - centerX ) + square( curr.y - centerY );
			this._scale *= Math.sqrt( prevR / currR );
		}
		else {
			const scale = (2.0 * this._scale) / Math.sqrt( rect.width * rect.height );
			this._phi   -= scale * (curr.x - prev.x);
			this._theta -= scale * (curr.y - prev.y);
		}

		if( prev.v !== null && curr.v !== null ) {
			this._scale *= Math.sqrt( prev.v / curr.v );
		}

		this._update( true );
	}

	_onWheel( ev ) {
		let scale;
		switch( ev.deltaMode ) {
			case WheelEvent.DOM_DELTA_PAGE : scale = 1.0 /   1.0; break;
			case WheelEvent.DOM_DELTA_LINE : scale = 1.0 /  30.0; break;
			case WheelEvent.DOM_DELTA_PIXEL: scale = 1.0 / 720.0; break;
		}
		this._scale *= Math.exp( scale * ev.deltaY );
		this._updateDelayed();
		ev.preventDefault();
	}

	_onResize( entries ) {
		const rect = this._element.getBoundingClientRect();
		this._element.width  = rect.width  * devicePixelRatio;
		this._element.height = rect.height * devicePixelRatio;
		this._updateDelayed();
	}
}

export class Element extends HTMLElement {
	static get observedAttributes() {
		return [ "src", "mapping" ];
	}

	constructor() {
		super();
		const shadow = this.attachShadow( { mode: "open" } );
		const canvas = shadow.appendChild( document.createElement( "canvas" ) );
		canvas.style.display = "inline-block";
		canvas.style.width   = "100%";
		canvas.style.height  = "100%";
		this._renderer = new Renderer( canvas );
		this._handler  = new Handler( canvas, this._renderer );
	}

	attributeChangedCallback( key, oldVal, newVal ) {
		switch( key ) {
			case "src": {
				const img = new Image();
				img.onload = () => {
					this._renderer.setImage( img );
					this._renderer.render( false );
				};
				img.src = newVal;
				break;
			}
			case "mapping": {
				this._renderer.setMapping( Mapping[newVal] );
				this._renderer.render( false );
				break;
			}
		}
	}

	get src    () { return this.getAttribute( "src"     ); }
	get mapping() { return this.getAttribute( "mapping" ); }

	set src    ( e ) { this.setAttribute( "src"    , e ); }
	set mapping( e ) { this.setAttribute( "mapping", e ); }
}

customElements.define( "x-zuho", Element );
