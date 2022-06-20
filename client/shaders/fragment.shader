varying vec2 v_texturePos;

uniform sampler2D u_texture;
uniform lowp int u_mode;
uniform float u_opacity;

#ifdef ENABLE_TRANSFORM
uniform sampler2D u_shutter;
uniform lowp int u_shutterMode;
uniform sampler2D u_fbTex;
uniform vec2 u_eTL;
uniform vec2 u_eTR;
uniform vec2 u_eBL;
uniform vec2 u_eBR;

// taken from https://iquilezles.org/articles/ibilinear/

float cross2d(in vec2 a, in vec2 b) { return a.x * b.y - a.y * b.x; }

vec2 transform3D(in vec2 p, in vec2 a, in vec2 b, in vec2 c, in vec2 d)
{
    vec2 res = vec2(-1.0);

    vec2 e = b - a;
    vec2 f = d - a;
    vec2 g = a - b + c - d;
    vec2 h = p - a;

    float k2 = cross2d(g, f);
    float k1 = cross2d(e, f) + cross2d(h, g);
    float k0 = cross2d(h, e);

    // if edges are parallel, this is a linear equation
    if (abs(k2) < 0.001)
    {
        res = vec2((h.x * k1 + f.x * k0) / (e.x * k1 - g.x * k0), -k0 / k1);
    }
    // otherwise, it's a quadratic
    else
    {
        float w = k1 * k1 - 4.0 * k0 * k2;
        if (w < 0.0) return vec2(-1.0);
        w = sqrt(w);

        float ik2 = 0.5 / k2;
        float v = (-k1 - w) * ik2;
        float u = (h.x - f.x * v) / (e.x + g.x * v);

        if (u < 0.0 || u>1.0 || v < 0.0 || v>1.0)
        {
            v = (-k1 + w) * ik2;
            u = (h.x - f.x * v) / (e.x + g.x * v);
        }
        res = vec2(u, v);
    }

    return res;
}
#endif

void main() {
    if (u_mode == 1) { // 1:1 copy
        gl_FragColor = texture2D(u_texture, v_texturePos);
        gl_FragColor.a = u_opacity;
    }
#ifdef ENABLE_TRANSFORM
    else if (u_mode == 2) {
        vec2 texPix = transform3D(v_texturePos, u_eTL, u_eTR, u_eBR, u_eBL);
        if (texPix.x < 0. || texPix.x > 1. || texPix.y < 0. || texPix.y > 1.) {
            gl_FragColor = vec4(0, 0, 0, 0); //transparent
        } else {
            gl_FragColor = texture2D(u_fbTex, texPix);
            float alpha = 1.;
            //shutterMode == 0 //disable shutter
            if (u_shutterMode == 1) { //red
                alpha = texture2D(u_shutter, v_texturePos).r;
            } else if (u_shutterMode == 2) { //green
                alpha = texture2D(u_shutter, v_texturePos).g;
            } else if (u_shutterMode == 3) { //blue
                alpha = texture2D(u_shutter, v_texturePos).b;
            } else if (u_shutterMode == 4) { //alpha
                alpha = texture2D(u_shutter, v_texturePos).a;
            }
#ifdef SHUTTER_STAIRS
            gl_FragColor.a = alpha > .5 ? 1. : 0.;
#else
            gl_FragColor.a = alpha;
#endif
        }
    }
#endif
}