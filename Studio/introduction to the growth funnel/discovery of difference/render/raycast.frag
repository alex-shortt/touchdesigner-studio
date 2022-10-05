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
    f += 0.2500*noise( p ); p = m*p*2.03;
    f += 0.12500*noise( p ); p = m*p*2.01;
    f += 0.06250*noise( p );
    return f;
}

// smin from the legend iq 
float smin( float d1, float d2, float k ) {
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h); 
}

#define VOL_LENGTH 20. // total length of the raymarch
#define VOL_STEPS 4.*48 // steps to take within that length
#define VOL_DENSITY 4.8

#define SHA_STEPS 10
#define SHA_LENGTH 2.
#define SHA_DENSITY 0.12

#define DLIGHT_DIR normalize(vec3(2., 8., 1.))
#define DLIGHT_POW 1.9

#define ALIGHT_COL vec3(1., 1., 1.)
#define ALIGHT_DENSITY 0.2

#define EXTINCTION_COL vec3(0.1, 0.1, 0.1)

float jitter;

// returns (color, depth)
float volume( vec3 p )
{
    // get noise value
    float t = time * 0.925;
    
    float noise_sc = 2.5;
    vec3 q = 0.4 * ((p * noise_sc) - vec3(0.0,0.5,1.0) * t);
    float f = fbm(q);

    float d = 0.;

    float side_len = floor(sqrt(num_ideas));
    for(float x = 0; x < side_len; x++) {
        for(float y = 0; y < side_len; y++) {
            vec2 uv = vec2(x + 0.1, y + 0.1) / vec2(side_len);
            vec3 tex = texture(sTD2DInputs[0], uv).rgb;
            vec3 idea_pos = tex.xyz;
            float MAX_RAD = 0.3;
            float dist = clamp(length(p - idea_pos), -1., 1.); // not sure why but clamp fixes things
            float rad = clamp(dist / MAX_RAD + (f - 0.5) * 7., 0., 1.);
            d += pow((1. - rad), 1.) * f;
        }
    }
    
    // implicit geometries using sdf
    // float s1 = sdSphere(p - POS_1 + f * 0.9, 2.);
    // float s2 = sdSphere(p - POS_2 + f * 1.7, 1.5);
    
    return d;
}

vec4 raymarchVolume(vec3 origin, vec3 ray) {
    float stepLength = VOL_LENGTH / float(VOL_STEPS);
    float shadowStepLength = SHA_LENGTH / float(SHA_STEPS);
    
    float volumeDensity = VOL_DENSITY * shadowStepLength;
    float shadowDensity = SHA_DENSITY * shadowStepLength;
    vec3 dlight = DLIGHT_POW * DLIGHT_DIR * shadowStepLength;
    
    float density = 0.;
    float transmittance = 1.;
    vec3 energy = vec3(0.);
    vec3 pos = origin + ray * jitter * stepLength;
    
    // raymarch
    for (int i = 0; i < VOL_STEPS; i++) {
        float dsample = volume(pos);
        
        if(transmittance < 0.05) break;
        
        if (dsample > 0.001) {
            vec3 lpos = pos;
            float shadow = 0.;
            
            // raymarch shadows
            for (int s = 0; s < SHA_STEPS; s++) {
                lpos += dlight;
                float lsample = volume(lpos);
                shadow += lsample;
            }
            
            // combine shadow with density
            density = clamp(dsample * volumeDensity, 0., 1.);
            vec3 shadowterm = exp(-shadow * shadowDensity / EXTINCTION_COL);
            vec3 absorbedlight = shadowterm * density;
            energy += absorbedlight * transmittance;
            transmittance *= 1. - density;     
            
            // ambient lighting
            shadow = 0.;
            float asample = 0.;
            for (float s = 0.; s < 1.; s++) {
                lpos = pos + vec3(0., 0., 0.05 + s * 1.3);
                asample = volume(lpos);
                shadow += asample / (0.05 + s * 1.3);
            }
            
            energy += exp(-shadow * ALIGHT_DENSITY) * density * ALIGHT_COL * transmittance;
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
    
    jitter = 0.1 * hash(cam_pos.x + cam_pos.y * 24. + time*0.05);
    vec4 col = raymarchVolume(cam_pos, ray);
    
    // Output to screen
    vec3 top_col = vec3(1.);
    vec3 bot_col = vec3(1.);
    vec3 bg = mix(top_col, bot_col, cam_pos.y - 0.55);

    vec3 result = (col.rgb + bg) * col.a;
    fragColor = vec4(result, 1.);
}
