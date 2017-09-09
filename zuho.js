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
		let gl = this.gl = elem.getContext( "webgl" );

		// shader program.
		function compile( src, type ) {
			let shader = gl.createShader( type );
			gl.shaderSource( shader, src );
			gl.compileShader( shader );
			let log = gl.getShaderInfoLog( shader );
			if( log.length > 0 ) {
				console.log( log );
			}
			return shader;
		}
		let vert = compile( this.vertShader, gl.VERTEX_SHADER );
		let frag = compile( this.fragShader, gl.FRAGMENT_SHADER );
		this.prog = gl.createProgram();
		gl.attachShader( this.prog, vert );
		gl.attachShader( this.prog, frag );
		gl.linkProgram( this.prog );
		let log = gl.getProgramInfoLog( this.prog );
		if( log.length > 0 ) {
			console.log( log );
		}
		this.setCamera( Matrix.identity( 3 ), this.Mode.perspective, 2.0 );

		// vertex buffer.
		this.vbo = gl.createBuffer();
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vbo );
		gl.bufferData( gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW ); 

		// texture.
		this.tex = gl.createTexture();
		gl.bindTexture( gl.TEXTURE_2D, this.tex );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE );
		gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE );

		// unbind.
		gl.bindTexture( gl.TEXTURE_2D, null );
		gl.bindBuffer( gl.ARRAY_BUFFER, null );
	}

	setImage( img ) {
		let gl = this.gl;
		gl.bindTexture( gl.TEXTURE_2D, this.tex );
		gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img );
		gl.bindTexture( gl.TEXTURE_2D, null );
	}

	setCamera( rot, mode, scale ) {
		let gl = this.gl;
		let f = scale / Math.sqrt( gl.drawingBufferWidth * gl.drawingBufferHeight );
		let sx = f * gl.drawingBufferWidth;
		let sy = f * gl.drawingBufferHeight;
		gl.useProgram( this.prog );
		gl.uniformMatrix3fv( gl.getUniformLocation( this.prog, "uRot"   ), false, rot    );
		gl.uniform1f       ( gl.getUniformLocation( this.prog, "uMode"  ),        mode   );
		gl.uniform2f       ( gl.getUniformLocation( this.prog, "uScale" ),        sx, sy );
		gl.useProgram( null );
	}

	render() {
		let gl = this.gl;
		gl.useProgram( this.prog );

		gl.enableVertexAttribArray( 0 );
		gl.bindBuffer( gl.ARRAY_BUFFER, this.vbo );
		gl.vertexAttribPointer( 0, 2, gl.FLOAT, false, 0, 0 );

		gl.activeTexture( gl.TEXTURE0 );
		gl.bindTexture( gl.TEXTURE_2D, this.tex );
		gl.uniform1i( gl.getUniformLocation( this.prog, "uTex" ), 0 );

		gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );

		gl.bindTexture( gl.TEXTURE_2D, null );
		gl.bindBuffer( gl.ARRAY_BUFFER, null );
		gl.useProgram( null );
	}
}

Renderer.prototype.vertices = new Float32Array( [
	-1.0, -1.0, +1.0, -1.0, -1.0, +1.0, +1.0, +1.0,
] );

Renderer.prototype.fragShader = String.raw`
	precision highp float;
	const   float     pi = 3.14159265359;
	uniform sampler2D uTex;
	uniform mat3      uRot;
	uniform float     uMode;
	varying vec2      vPos;

	void main() {
		//vec3 pos = vec3( vPos, 1.0 );
		//vec3 pos = vec3( vPos, sqrt( 1.0 - dot( vPos, vPos ) ) );
		vec3 pos = vec3( vPos, 1.0 - 0.25 * dot( vPos, vPos ) );
		vec3 dir = normalize( uRot * pos );
		float u = (0.5 / pi) * atan( dir[1], dir[0] ) + 0.5;
		float v = (1.0 / pi) * acos( dir[2] );
		gl_FragColor = texture2D( uTex, vec2( u, v ) );
	}
`;

Renderer.prototype.vertShader = String.raw`
	uniform   vec2 uScale;
	attribute vec2 aPos;
	varying   vec2 vPos;

	void main() {
		gl_Position = vec4( aPos, 0.0, 1.0 );
		vPos = uScale * aPos;
	}
`;

Renderer.prototype.Mode = {
	perspective: 0,
	cylindrical: 1,
	stereo:      2,
};

class Handler {
	constructor( elem, renderer ) {
		this.element  = elem;
		this.renderer = renderer;
		this.mousePos = null;
		this.theta    = Math.PI / -2.0;
		this.phi      = 0.0;
		this.logScale = 0.0;
		elem.addEventListener( "mousedown", this.onMouseDown.bind( this ) );
		elem.addEventListener( "mouseup",   this.onMouseUp  .bind( this ) );
		elem.addEventListener( "mousemove", this.onMouseMove.bind( this ) );
		this.update();
	}

	onMouseDown( ev ) {
		this.mousePos = [ ev.clientX, ev.clientY ];
		ev.target.setCapture();
	}

	onMouseUp( ev ) {
		this.mousePos = null;
	}

	onMouseMove( ev ) {
		if( this.mousePos === null ) {
			return;
		}

		let rect = this.element.getBoundingClientRect();
		let unit = 2.0 / Math.sqrt( rect.width * rect.height );
		let dx = ev.clientX - this.mousePos[0];
		let dy = ev.clientY - this.mousePos[1];
		if( ev.shiftKey ) {
			this.logScale -= unit * (dx + dy);
		}
		else {
			let scale = Math.exp( this.logScale ) * unit;
			this.phi   += scale * dx;
			this.theta += scale * dy;
		}
		this.mousePos = [ ev.clientX, ev.clientY ];

		this.update();
	}

	update() {
		let rot = Matrix.mul( 3,
			Matrix.rotation( 3, 1, 2, this.theta ),
			Matrix.rotation( 3, 0, 1, this.phi   )
		);
		let scale = Math.exp( this.logScale );
		this.renderer.setCamera( rot, this.renderer.Mode.perspective, scale );
		this.renderer.render();
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
