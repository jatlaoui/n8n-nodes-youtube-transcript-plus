/* eslint-disable @typescript-eslint/no-var-requires */
const gulp = require('gulp');

// Define the task to build icons
function buildIcons() {
	return gulp.src(['nodes/**/*.svg']).pipe(gulp.dest('dist/nodes'));
}

// Export the task
exports['build:icons'] = buildIcons;
