uniform float time;	
vec2 iResolution = vec2(960, 540);

// uniform float exampleUniform;

out vec4 fragColor;



// camera from https://www.shadertoy.com/view/4dcBRN
mat3 camera(vec3 ro, vec3 ta, float cr ) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(cr), cos(cr),0.);
    vec3 cu = normalize( cross(cw,cp) );
    vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
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

#define VOL_STEPS 2.*48
#define VOL_LENGTH 7.
#define VOL_DENSITY 4.

#define SHA_STEPS 10
#define SHA_LENGTH 2.
#define SHA_DENSITY 0.12

#define DLIGHT_DIR normalize(vec3(2., 5., 1.))
#define DLIGHT_POW 0.2

#define ALIGHT_COL vec3(0.15, 0.45, 1.1)
#define ALIGHT_DENSITY 0.2

#define EXTINCTION_COL vec3(0.6, 0.6, 1.)

float jitter;

// returns (color, depth)
float volume( vec3 p )
{
    // get noise value
    float t = time * 0.125;
    
    vec3 q = 0.9 * (p - vec3(0.0,0.5,1.0) * t * 0.5);
    float f = fbm(q);
    
    float s1 = 1.0 - length(p * vec3(0.6, 1.3, 0.8)) + f * 2.2;
    float s2 = 1.0 - length(p * vec3(1.1, 1.2, 0.8)) + f * 2.9;
    float s3 = 1.0 - length(p * vec3(sin(t) * 0.4 + 0.6, 1., 1.)) + f * 3.4;
    float s4 = 0.8 * smin(s2, s3, 3.);

    
    float d = mix(s1, s4, (sin(t) + 1.) / 2.);
    
    return d;
}

vec4 raymarchVolume(vec3 rot, vec3 ray) {
    float stepLength = VOL_LENGTH / float(VOL_STEPS);
    float shadowStepLength = SHA_LENGTH / float(SHA_STEPS);
    
    float volumeDensity = VOL_DENSITY * shadowStepLength;
    float shadowDensity = SHA_DENSITY * shadowStepLength;
    vec3 dlight = DLIGHT_POW * DLIGHT_DIR * shadowStepLength;
    
    float density = 0.;
    float transmittance = 1.;
    vec3 energy = vec3(0.);
    vec3 pos = rot + ray * jitter * stepLength;
    
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
    // set up raycast
    vec2 origin = 2. * (vUV.st - 0.5);
    vec3 rot = vec3(cos(time * .3) * 8., -3.5, sin(time * .3) * 8.);
    vec3 tran = vec3(0., 0.4, 0.3);
    mat3 cam = camera(rot, tran, 0.);
    vec3 ray = cam * normalize(vec3(origin, 2.5));
    
    jitter = 0.4 * hash(origin.x + origin.y * 54. + time);
    vec4 col = raymarchVolume(rot, ray);
    
    // Output to screen
    vec3 top_col = vec3(0.3, 0.6, 1.);
    vec3 bot_col = vec3(0.05, 0.35, 1.);
    vec3 result = col.rgb + mix(top_col, bot_col, origin.y - 0.55) * col.a;
    
    fragColor = vec4(result, 1.);
}
