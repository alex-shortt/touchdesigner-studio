// Example Compute Shader

uniform float size;

layout (local_size_x = 8, local_size_y = 8) in;
void main()
{
    vec3 pos = texelFetch(sTD2DInputs[0], ivec2(gl_GlobalInvocationID.xy), 0).rgb;
    
    vec3 force = vec3(0.);

    float num_ideas = size * size;
    float index = gl_GlobalInvocationID.x + gl_GlobalInvocationID.y * size;
    float perc = index / (num_ideas);

    float center_force = 0.007;

    float y = num_ideas - index - 1.;
    for(float x = 0.; x < num_ideas; x++) {
        if(x != index) {
           vec3 other_pos = texelFetch(sTD2DInputs[0], ivec2(x, y), 0).rgb;
           float edge_influence = texelFetch(sTD2DInputs[2], ivec2(x, y), 0).r;

           vec3 offset = other_pos- pos;
           vec3 dir = normalize(offset);

           float dist = length(offset);
           float v = 9.8 * 0.01 * edge_influence / (dist * dist * dist);
           force += offset * v;
          
        }
    }

    float dist_to_cen = length(pos);
    vec3 dir_center = normalize(pos * -1);
    force += dir_center * center_force * dist_to_cen;

	vec4 color = vec4(force, 1.);
	//color = texelFetch(sTD2DInputs[1], ivec2(gl_GlobalInvocationID.xy), 0);
	

	imageStore(mTDComputeOutputs[0], ivec2(gl_GlobalInvocationID.xy), TDOutputSwizzle(color));
}
