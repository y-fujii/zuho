// (c) Yasuhiro Fujii <y-fujii at mimosa-pudica.net>, under MIT License.
"use strict";


class Matrix {
	static mul( n, x, y ) {
		console.assert( x.length == n * n && y.length == n * n );
		let z = new Float32Array( n * n );
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
		let z = new Float32Array( n * n );
		z.fill( 0.0 );
		for( let i = 0; i < n; ++i ) {
			z[i * n + i] = 1.0;
		}
		return z;
	}

	static rotation( n, i, j, arg ) {
		console.assert( i < n && j < n );
		let z = this.identity( n );
		let cos = Math.cos( arg );
		let sin = Math.sin( arg );
		z[i * n + i] = +cos;
		z[i * n + j] = -sin;
		z[j * n + i] = +sin;
		z[j * n + j] = +cos;
		return z;
	}
}

class Renderer {
	constructor( elem ) {
		let gl = this._gl = elem.getContext( "webgl" );

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
		this.setMapping( Object.values( Mapping )[0] );
		this.setCamera( Matrix.identity( 3 ), 2.0 );

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
		let gl = this._gl;
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
		let gl = this._gl;
		let prog = fast ? this._progFast : this._progSlow;
		gl.useProgram( prog );
		let f = this._scale / Math.sqrt( gl.drawingBufferWidth * gl.drawingBufferHeight );
		let sx = f * gl.drawingBufferWidth;
		let sy = f * gl.drawingBufferHeight;
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
		let gl = this._gl;
		gl.shaderSource( shader, src );
		gl.compileShader( shader );
		let log = gl.getShaderInfoLog( shader );
		if( log.length > 0 ) {
			console.log( log );
		}
	}

	_link( prog ) {
		let gl = this._gl;
		gl.linkProgram( prog );
		let log = gl.getProgramInfoLog( prog );
		if( log.length > 0 ) {
			console.log( log );
		}
	}
}

Renderer._vertices = new Float32Array( [
	-1.0, -1.0, +1.0, -1.0, -1.0, +1.0, +1.0, +1.0,
] );

Renderer._fragSourceCommon = String.raw`
	precision mediump float;
	const   float     pi = 3.14159265359;
	uniform float     uPxSize;
	uniform mat3      uRot;
	uniform sampler2D uTex;
	varying vec2      vPos;

	vec3 unproject( vec2 );

	vec4 sample( float dx, float dy ) {
		vec2 pos = vPos + uPxSize * vec2( dx, dy );
		vec3 dir = normalize( uRot * unproject( pos ) );
		float u = (0.5 / pi) * atan( dir[1], dir[0] ) + 0.5;
		float v = (1.0 / pi) * acos( dir[2] );
		return texture2D( uTex, vec2( u, v ) );
	}
`;

Renderer._fragSourceFast = String.raw`
	void main() {
		gl_FragColor = sample( 0.0, 0.0 );
	}
`;

Renderer._fragSourceSlow = String.raw`
	vec4 sampleSq( float dx, float dy ) {
		vec4 s = sample( dx, dy );
		return s * s;
	}

	void main() {
		// (2, 3) halton vector sequences.
		vec4 acc =
			(((sampleSq(  1.0 /  2.0 - 0.5,  1.0 /  3.0 - 0.5 ) +
			   sampleSq(  1.0 /  4.0 - 0.5,  2.0 /  3.0 - 0.5 )) +
			  (sampleSq(  3.0 /  4.0 - 0.5,  1.0 /  9.0 - 0.5 ) +
			   sampleSq(  1.0 /  8.0 - 0.5,  4.0 /  9.0 - 0.5 ))) +
			 ((sampleSq(  5.0 /  8.0 - 0.5,  7.0 /  9.0 - 0.5 ) +
			   sampleSq(  3.0 /  8.0 - 0.5,  2.0 /  9.0 - 0.5 )) +
			  (sampleSq(  7.0 /  8.0 - 0.5,  5.0 /  9.0 - 0.5 ) +
			   sampleSq(  1.0 / 16.0 - 0.5,  8.0 /  9.0 - 0.5 )))) +
			(((sampleSq(  9.0 / 16.0 - 0.5,  1.0 / 27.0 - 0.5 ) +
			   sampleSq(  5.0 / 16.0 - 0.5, 10.0 / 27.0 - 0.5 )) +
			  (sampleSq( 13.0 / 16.0 - 0.5, 19.0 / 27.0 - 0.5 ) +
			   sampleSq(  3.0 / 16.0 - 0.5,  4.0 / 27.0 - 0.5 ))) +
			 ((sampleSq( 11.0 / 16.0 - 0.5, 13.0 / 27.0 - 0.5 ) +
			   sampleSq(  7.0 / 16.0 - 0.5, 22.0 / 27.0 - 0.5 )) +
			  (sampleSq( 15.0 / 16.0 - 0.5,  7.0 / 27.0 - 0.5 ) +
			   sampleSq(  1.0 / 32.0 - 0.5, 16.0 / 27.0 - 0.5 ))));
		gl_FragColor = sqrt( (1.0 / 16.0) * acc );
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

let Mapping = {
	azEquiarea: String.raw`
		vec3 unproject( vec2 p ) {
			float t = dot( p, p );
			return vec3( p, (2.0 - t) / sqrt( 4.0 - t ) );
		}
	`,
	azConformal: String.raw`
		vec3 unproject( vec2 p ) {
			return vec3( p, 1.0 - 0.25 * dot( p, p ) );
		}
	`,
	azPerspective: String.raw`
		vec3 unproject( vec2 p ) {
			return vec3( p, 1.0 );
		}
	`,
	azOrthogonal: String.raw`
		vec3 unproject( vec2 p ) {
			return vec3( p, sqrt( 1.0 - dot( p, p ) ) );
		}
	`,
	azEquidistant: String.raw`
		vec3 unproject( vec2 p ) {
			float r = length( p );
			return vec3( p, r / tan( r ) );
		}
	`,
	azReflect: String.raw`
		vec3 unproject( vec2 p ) {
			return vec3( p, 2.0 - 1.0 / sqrt( 1.0 - dot( p, p ) ) );
		}
	`,
	cyConformal: String.raw`
		vec3 unproject( vec2 p ) {
			float phi = 2.0 * atan( exp( p[1] ) ) - pi / 2.0;
			return vec3(
				cos( phi ) * sin( p[0] ),
				sin( phi ),
				cos( phi ) * cos( p[0] )
			);
		}
	`,
	cyPerspective: String.raw`
		vec3 unproject( vec2 p ) {
			return vec3( sin( p[0] ), p[1], cos( p[0] ) );
		}
	`,
	cyEquidistant: String.raw`
		vec3 unproject( vec2 p ) {
			return vec3(
				cos( p[1] ) * sin( p[0] ),
				sin( p[1] ),
				cos( p[1] ) * cos( p[0] )
			);
		}
	`,
	mollweide: String.raw`
		vec3 unproject( vec2 p ) {
			float theta = asin( p[1] );
			float sinPhi = (1.0 / pi) * (2.0 * theta + sin( 2.0 * theta ));
			float cosPhi = sqrt( 1.0 - sinPhi * sinPhi );
			float lambda = (pi / 2.0) * p[0] / cos( theta );
			return vec3(
				cosPhi * sin( lambda ),
				sinPhi,
				cosPhi * cos( lambda )
			);
		}
	`,
};

class Handler {
	constructor( elem, renderer ) {
		this._element  = elem;
		this._renderer = renderer;
		this._mousePos = null;
		this._theta    = Math.PI / -2.0;
		this._phi      = 0.0;
		this._logScale = 0.0;
		this._mapping  = 0;
		elem.addEventListener( "mousedown", this._onMouseDown.bind( this ) );
		elem.addEventListener( "mouseup",   this._onMouseUp  .bind( this ) );
		elem.addEventListener( "mousemove", this._onMouseMove.bind( this ) );
		elem.addEventListener( "dblclick",  this._onDblClick .bind( this ) );
		this.update( false );
	}

	_onMouseDown( ev ) {
		if( ev.button != 0 ) {
			return;
		}
		this._mousePos = [ ev.clientX, ev.clientY ];
		ev.target.setCapture();
	}

	_onMouseUp( ev ) {
		this._mousePos = null;
		this.update( false );
	}

	_onMouseMove( ev ) {
		if( this._mousePos === null ) {
			return;
		}

		let rect = this._element.getBoundingClientRect();
		let unit = 2.0 / Math.sqrt( rect.width * rect.height );
		let dx = ev.clientX - this._mousePos[0];
		let dy = ev.clientY - this._mousePos[1];
		if( ev.shiftKey ) {
			this._logScale -= unit * (dx + dy);
		}
		else {
			let scale = Math.exp( this._logScale ) * unit;
			this._phi   += scale * dx;
			this._theta += scale * dy;
		}
		this._mousePos = [ ev.clientX, ev.clientY ];

		this.update( true );
	}

	_onDblClick( ev ) {
		let maps = Object.values( Mapping );
		this._mapping = (this._mapping + 1) % maps.length;
		this._renderer.setMapping( maps[this._mapping] );
		this.update( false );
	}

	update( fast ) {
		let rot = Matrix.mul( 3,
			Matrix.rotation( 3, 1, 2, this._theta ),
			Matrix.rotation( 3, 0, 1, this._phi   )
		);
		let scale = Math.exp( this._logScale );
		this._renderer.setCamera( rot, scale );
		this._renderer.render( fast );
	}
}

window.addEventListener( "DOMContentLoaded", function( ev ) {
	for( let elem of document.querySelectorAll( ".equirectangular" ) ) {
		let img = new Image();
		img.onload = () => {
			let rect = elem.getBoundingClientRect();
			let canvas = document.createElement( "canvas" );
			canvas.style.position = "absolute";
			canvas.style.width    = String( rect.width  ) + "px";
			canvas.style.height   = String( rect.height ) + "px";
			canvas.width  = rect.width  * devicePixelRatio;
			canvas.height = rect.height * devicePixelRatio;
			let renderer = new Renderer( canvas );
			renderer.setImage( img );
			new Handler( canvas, renderer );
			elem.appendChild( canvas );
		}
		img.src = elem.getAttribute( "src" );
	}
} );
