// Example Compute Shader

uniform float size;

layout (local_size_x = 32, local_size_y = 32) in;
void main()
{
    vec3 pos = texelFetch(sTD2DInputs[0], ivec2(gl_GlobalInvocationID.xy), 0).rgb;
    
    vec3 force = vec3(0.);

    float num_ideas = size * size;
    float index = gl_GlobalInvocationID.x + gl_GlobalInvocationID.y * size;
    float perc = index / (num_ideas);


	int side_len = int(floor(sqrt(num_ideas)));
	float i = 0.;
    for(float y = 0.; y < size; y++) {
      for(float x = 0.; x < size; x++) {
      		if ( i >= num_ideas || x == gl_GlobalInvocationID.x || y == gl_GlobalInvocationID.y ) { 
      			continue;
      		}

			// read values
			vec3 other_pos = texelFetch(sTD2DInputs[0], ivec2(x, y), 0).rgb;
          	float spring_length = texelFetch(sTD2DInputs[1], ivec2(mod(index, 32.), mod(index, 32.)), 0).r;

			// calculate constants values
			vec3 offset = other_pos - pos;
			float dist = length(offset) + 0.01;
           	vec3 dir = normalize(offset);

			// apply coulomb's law
           	float repulsion = -0.9 / (dist * dist * dist);
           	force += repulsion * dir;

			// apply hook's law
			float displacement = spring_length - dist;
			force += -0.5 * displacement * dir;
	        
	       	i += 1.;
        }
    }


	// attract to center
    float center_strength = 19.85;
    vec3 dir_center = -1. * normalize(pos);
    force += dir_center * center_strength;

	vec4 final_force = vec4(force, 1.);

	imageStore(mTDComputeOutputs[0], ivec2(gl_GlobalInvocationID.xy), TDOutputSwizzle(final_force));
}
