layout (local_size_x = 32, local_size_y = 32) in;

uniform float time;	
uniform vec3 cam_pos;
uniform vec3 cam_look;
uniform vec2 resolution;
uniform float side_len;
uniform float fov;
uniform int part_index;
uniform vec2 part_resolution;
uniform vec2 parts;

const vec4 p_lights[NUM_P_LIGHTS] = vec4[](vec4(0, 0, 0, 2.9), vec4(0, 0, 0, 2.9));



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
    // if(length(col) > 1.) return normalize(col);
    return col;
}


// idea constants
float MAX_RAD = 0.875, FALLOFF = 10, NOISE_SPEED = 0.925, NOISE_SCALE = 2.1;

// loop stuff
float d, dist, rad, x, y, ind, jitter;   
vec3 idea_pos;

float volume( vec3 p )
{
    d = 0;
    ind = 0;

    for(int i = 0; i < NUM_IDEAS; i++) {
        // get dist value
        x = mod(ind, side_len) / side_len;
        y = floor(ind / side_len) / side_len;
        idea_pos = texture(sTD2DInputs[0], vec2(x, y)).rgb;
        dist = length(p - idea_pos);

        // get noise value
        vec3 q = p * NOISE_SCALE + vec3(time * NOISE_SPEED) + vec3(i * 100.);
        float f = fbm(q);

        // get radius value
        dist += f * MAX_RAD;
        rad = dist / MAX_RAD;
        rad = clamp(rad, 0., 1.);
        rad = pow(rad, FALLOFF);
        rad = 1. - rad;

        // add to dist, iterate
        d += rad;
        ind += 1.;
    }

    // apply fog
    // float dist_to_cen = length(p) / FOG_FAR;
    // d = min(d, 1 - dist_to_cen);  

    return d;
}

vec3 shadowterm = vec3(1);

void apply_p_light(int index, vec3 lpos) {
    if(index >= NUM_P_LIGHTS) return;
    
    vec4 p_light = p_lights[index];

    if(p_light.a <= 0.) return;

    float shadow = 0.;

    vec3 p_light_offset = p_light.xyz - lpos;
    float p_step_len = length(p_light_offset) / float(SHA_STEPS);
    for (int s = 0; s < SHA_STEPS; s += 1) {
        lpos += normalize(p_light_offset) * 8. / float(SHA_STEPS);
        float p_light_pow = p_light.a / pow(float(s) * p_step_len, 2.);
        float lsample = volume(lpos);
        shadow += lsample * clamp(p_light_pow * 0.000001, 0., 1.);
    }

    float shadowDensity = clamp(SHA_DENSITY * p_step_len, 0., 1.);
    vec3 p_light_col = pos_to_mediation(p_light.xyz);
    shadowterm += exp(-shadow * shadowDensity / p_light_col);
}

vec4 raymarchVolume(vec3 origin, vec3 ray) {
    float stepLength = VOL_LENGTH / VOL_STEPS;
    float volumeDensity = VOL_DENSITY * stepLength;
    
    float density = 0.;
    float transmittance = 1.;
    vec3 energy = vec3(0.);
    vec3 pos = origin + ray * jitter * stepLength;
    vec3 absorbedlight = vec3(1.0);
    
    // raymarch
    for (int i = 0; i < VOL_STEPS; i++) {
        float dsample = volume(pos);
        
        if(transmittance < 0.0001) break;

        if (dsample > 0.00001) {
            #if RENDER_P_LIGHTS
            // raymarch shadows from each point light
            shadowterm = vec3(0.);
            for (int l = 0; l < NUM_P_LIGHTS; l += 1){
                apply_p_light(l, pos);
            }

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

    // use index to count through parts
    float offset_x = (mod(float(part_index), parts.x)) * part_resolution.x;
    float offset_y = floor(float(part_index) / parts.x) * part_resolution.y;
    vec2 fragCoord = vec2(gl_GlobalInvocationID.xy) + vec2(offset_x, offset_y);

    // create the ray
    vec3 viewDir = rayDirection(fov+FOV_OFFSET, resolution, fragCoord);
    mat3 viewToWorld = viewMatrix(cam_pos, cam_look, vec3(0,1,0));
    vec3 ray = viewToWorld * viewDir;

    jitter = 0.01 * hash(gl_GlobalInvocationID.x * 122. + gl_GlobalInvocationID.y * 124. + time*0.5);
    vec4 col = raymarchVolume(cam_pos, ray);

    // debug
    // col.rgb = abs(ray);
    // col.rg = fragCoord / resolution;
    // col.b = 0;
    // col.a = 0;
    // vec2 uv = fragCoord / resolution;
    // col.rgb = texture(sTD2DInputs[0], uv).rgb;
    
    // Output to screen
    vec3 result = mix(col.rgb,  vec3(1.),  col.a);

	imageStore(mTDComputeOutputs[0], ivec2(gl_GlobalInvocationID.xy), TDOutputSwizzle(vec4(result, 1.)));
}