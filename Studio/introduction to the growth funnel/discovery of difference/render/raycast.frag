uniform float time;	
uniform vec3 cam_pos;
uniform vec3 cam_look;
uniform vec2 resolution;
uniform float num_ideas;
uniform float fov;

out vec4 fragColor;

vec3 rayDirection(float fieldOfView, vec2 size, vec2 fragCoord) {
    vec2 xy = fragCoord - size / 2.0;
    float z = size.y / tan(radians(fieldOfView) / 2.0);
    return normalize(vec3(xy, -z));
}

mat3 viewMatrix(vec3 eye, vec3 center, vec3 up) {
    // Based on gluLookAt man page
    vec3 f = normalize(center - eye);
    vec3 s = normalize(cross(f, up));
    vec3 u = cross(s, f);
    return mat3(s, u, -f);
}

// fbm from https://www.shadertoy.com/view/lss3zr
mat3 m = mat3( 0.00,  0.80,  0.60,
              -0.80,  0.36, -0.48,
              -0.60, -0.48,  0.64 );
float hash( float n ) { 
    return fract(sin(n)*43758.5453); 
}

float noise( in vec3 x ) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float n = p.x + p.y*57.0 + 113.0*p.z;
    float res = mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
                        mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y),
                    mix(mix( hash(n+113.0), hash(n+114.0),f.x),
                        mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
    return res;
}

float fbm( vec3 p ) {
    float f;
    f  = 0.5000*noise( p ); p = m*p*2.02;
    f += 0.2500*noise( p ); 
    p = m*p*2.03;
    f += 0.12500*noise( p ); 
    p = m*p*2.01;
    f += 0.06250*noise( p );
    return f;
}

// smin from the legend iq 
float smin( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h); 
}

vec3 srgb_from_linear_srgb(vec3 x) {

    vec3 xlo = 12.92*x;
    vec3 xhi = 1.055 * pow(x, vec3(0.4166666666666667)) - 0.055;
    
    return mix(xlo, xhi, step(vec3(0.0031308), x));

}

vec3 linear_srgb_from_srgb(vec3 x) {

    vec3 xlo = x / 12.92;
    vec3 xhi = pow((x + 0.055)/(1.055), vec3(2.4));
    
    return mix(xlo, xhi, step(vec3(0.04045), x));

}


//////////////////////////////////////////////////////////////////////
// oklab transform and inverse from
// https://bottosson.github.io/posts/oklab/

const mat3 fwdA = mat3(1.0, 1.0, 1.0,
                    0.3963377774, -0.1055613458, -0.0894841775,
                    0.2158037573, -0.0638541728, -1.2914855480);
                    
const mat3 fwdB = mat3(4.0767245293, -1.2681437731, -0.0041119885,
                    -3.3072168827, 2.6093323231, -0.7034763098,
                    0.2307590544, -0.3411344290,  1.7068625689);

const mat3 invB = mat3(0.4121656120, 0.2118591070, 0.0883097947,
                    0.5362752080, 0.6807189584, 0.2818474174,
                    0.0514575653, 0.1074065790, 0.6302613616);
                    
const mat3 invA = mat3(0.2104542553, 1.9779984951, 0.0259040371,
                    0.7936177850, -2.4285922050, 0.7827717662,
                    -0.0040720468, 0.4505937099, -0.8086757660);

vec3 oklab_from_linear_srgb(vec3 c) {
    vec3 lms = invB * c;
    return invA * (sign(lms)*pow(abs(lms), vec3(0.3333333333333)));
}
vec3 linear_srgb_from_oklab(vec3 c) {
    vec3 lms = fwdA * c;
    return fwdB * (lms * lms * lms);
}
vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
const float max_chroma = 0.33;
//////////////////////////////////////////////////////////////////////


#define PI 3.14159265359    

#define VOL_LENGTH 40. // total length of the raymarch
#define VOL_STEPS 2*48 // steps to take within that length
#define VOL_DENSITY 1.9

#define SHA_STEPS 30.
#define SHA_DENSITY 0.22

#define FOG_FAR 40.

#define ALIGHT_COL vec3(1.)
#define ALIGHT_POW 0.2

#define RENDER_P_LIGHTS 1
#define NUM_P_LIGHTS 2
vec4 p_lights[NUM_P_LIGHTS] = vec4[](vec4(2.2, -0.5, 1.9, 1.9), vec4(-1., 0.9, 0., 0.9));

#define MAX_IDEAS 100
vec3 idea_values[MAX_IDEAS];

float jitter;


vec3 get_idea_value(int index){
  return idea_values[index];
}

void read_idea_values() {
    vec2 uv;
    float side_len = floor(sqrt(num_ideas));
    for(float x = 0; x < side_len; x++) {
        for(float y = 0; y < side_len; y++) {
            uv.x = (x + 0.1) / side_len;
            uv.y = (y + 0.1) / side_len;
            idea_values[int(x*side_len + y)] = texture(sTD2DInputs[0], uv).rgb;
        }
    }
}

vec3 pos_to_mediation(vec3 p) {
    float theta = atan(p.z, p.x);
	float rad = length(p) / 8.; // try to norm from 0, 1
    
    // ok lab stuff
    float L = 0.6;
    float chroma = rad*0.33229211;
    float a = chroma*cos(theta);
    float b = chroma*sin(theta);
    vec3 lab = vec3(L, a, b);
    vec3 rgb = linear_srgb_from_oklab(lab);
    rgb = clamp(rgb, 0.0, 1.);
    vec3 col = srgb_from_linear_srgb(rgb);
    if(length(col) > 1.) return normalize(col);
    return col;
}

// returns (color, depth)
float volume( vec3 p )
{
    // get noise value
    float t = time * 0.925;

    float d, dist, rad, MAX_RAD = 0.175;
    vec3 idea_pos;

    float side_len = floor(sqrt(num_ideas));
    for(int i = 0; i < num_ideas; i++) {
        float noise_scale = 1. + pow(hash(i), 2.)*15.; //12.5;
        vec3 q = 0.4 * ((p * noise_scale) - vec3(hash(i)*2.-1., hash(i + 1)*2.-1., hash(i+2)*2.-1.) * t);
        float f = fbm(q);

        idea_pos = get_idea_value(i);

        dist = clamp(length(p - idea_pos), -100., 100.); // not sure why but clamp fixes things
        rad = dist / MAX_RAD;
        rad += (f - 0.5) * 14.;
        rad = clamp(rad, 0., 1.);
        d += pow((1. - rad), 1.) * f;
    }

    // apply fog
    // float dist_to_cen = length(p) / FOG_FAR;
    // d = min(d, 1 - dist_to_cen);  

    return d;
}

float shadow, shadowDensity, p_step_len, p_light_pow, lsample;
vec3 shadowterm, p_light_offset, p_light_col;
vec4 p_light;
void apply_p_light(int index, vec3 lpos) {
    if(index >= NUM_P_LIGHTS) return;
    
    p_light = p_lights[index];

    if(p_light.a <= 0.) return;

    shadow = 0.;

    p_light_offset = p_light.xyz - lpos;
    p_step_len = length(p_light_offset) / float(SHA_STEPS);
    for (int s = 0; s < SHA_STEPS; s += 1) {
        lpos += p_light_offset / float(SHA_STEPS);
        p_light_pow = p_light.a / pow(float(s) * p_step_len, 2.);
        lsample = volume(lpos);
        shadow += lsample * clamp(p_light_pow * 0.000001, 0., 1.);
    }

    shadowDensity = clamp(SHA_DENSITY * p_step_len, 0., 1.);
    p_light_col = pos_to_mediation(p_light.xyz);
    shadowterm += exp(-shadow * shadowDensity / p_light_col);
}

vec4 raymarchVolume(vec3 origin, vec3 ray) {
    float stepLength = VOL_LENGTH / float(VOL_STEPS);
    float volumeDensity = VOL_DENSITY * stepLength;
    
    float density = 0.;
    float transmittance = 1.;
    vec3 energy = vec3(0.);
    vec3 pos = origin + ray * jitter * stepLength;
    vec3 absorbedlight;
    
    // raymarch
    for (int i = 0; i < VOL_STEPS; i++) {
        float dsample = volume(pos);
        
        if(transmittance < 0.001) break;

        if (dsample > 0.0001) {
            #if RENDER_P_LIGHTS
            // raymarch shadows from each point light
            shadowterm = vec3(0.);
            // apply_p_light(0, pos);
            // apply_p_light(1, pos);

            shadowterm /= float(NUM_P_LIGHTS);
            #endif

            // combine shadow with density
            density = clamp(dsample * volumeDensity, 0., 1.);
            absorbedlight = shadowterm * density;
            energy += absorbedlight * transmittance;
            transmittance *= 1. - density;     
            
            // ambient lighting
            energy += ALIGHT_POW * density * ALIGHT_COL * transmittance;
        }

        pos += ray * stepLength;
    }

    return vec4(energy, transmittance);
}



void main()
{
    // magic number idk
    float FOV_OFFSET = 6;

    // set up raycast
    vec2 fragCoord = vUV.st * resolution.xy;
    vec3 viewDir = rayDirection(fov+FOV_OFFSET, resolution, fragCoord);
    mat3 viewToWorld = viewMatrix(cam_pos, cam_look, vec3(0,1,0));
    vec3 ray = viewToWorld * viewDir;

    // load in idea values from texture for this frame
    read_idea_values();

    jitter = 0.1 * hash(cam_pos.x + cam_pos.y * 24. + time*0.05);
    vec4 col = raymarchVolume(cam_pos, ray);
    
    // Output to screen
    vec3 bg = vec3(1.);
    vec3 result = mix(col.rgb,  vec3(1.),  col.a);
    fragColor = vec4(result, 1.);
}
