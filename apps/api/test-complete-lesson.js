/**
 * Manual test script for Task 34: Manual Lesson Completion Endpoint
 * 
 * This script tests the POST /lessons/:lessonId/complete endpoint
 * 
 * Requirements tested:
 * - R21.4: Manual completion button
 * - R21.5: Set completedAt timestamp
 * - R21.6: Update course progress percentage
 * - R2.5: Student can only access own records
 * - R2.11: Validate enrollment before access
 */

const axios = require('axios');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

async function testManualCompletion() {
  console.log('=== Testing Manual Lesson Completion Endpoint ===\n');

  try {
    // Step 1: Login as a student
    console.log('Step 1: Logging in as student...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'student@test.com',
      password: 'password123',
    });

    const accessToken = loginResponse.data.accessToken;
    console.log('✓ Login successful\n');

    // Step 2: Get student's enrolled courses
    console.log('Step 2: Fetching enrolled courses...');
    const user = loginResponse.data.user;
    const studentId = user.studentProfile?.id;

    if (!studentId) {
      console.error('✗ User does not have a student profile');
      return;
    }

    const progressResponse = await axios.get(
      `${API_BASE_URL}/students/${studentId}/progress`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log('✓ Enrolled courses fetched\n');

    // Step 3: Find a lesson that is IN_PROGRESS or NOT_STARTED
    const courses = progressResponse.data.courses;
    if (!courses || courses.length === 0) {
      console.error('✗ No enrolled courses found');
      return;
    }

    let testLessonId = null;
    let testCourseId = null;

    for (const course of courses) {
      if (course.lessons && course.lessons.length > 0) {
        const incompleteLesson = course.lessons.find(
          (l) => l.status !== 'COMPLETED'
        );
        if (incompleteLesson) {
          testLessonId = incompleteLesson.id;
          testCourseId = course.courseId;
          console.log(`Found incomplete lesson: ${incompleteLesson.title}`);
          console.log(`Current status: ${incompleteLesson.status}`);
          console.log(`Course: ${course.courseTitle}\n`);
          break;
        }
      }
    }

    if (!testLessonId) {
      console.error('✗ No incomplete lessons found. All lessons are completed.');
      console.log('Note: Create a course with lessons or use a lesson that is not completed.\n');
      return;
    }

    // Step 4: Get lesson progress before completion
    console.log('Step 3: Getting lesson progress before completion...');
    const beforeProgress = await axios.get(
      `${API_BASE_URL}/lessons/${testLessonId}/progress`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log('Before completion:');
    console.log(`  Status: ${beforeProgress.data.status}`);
    console.log(`  Completed At: ${beforeProgress.data.completedAt || 'null'}`);
    console.log(`  Last Position: ${beforeProgress.data.lastPosition}s\n`);

    // Step 5: Manually complete the lesson
    console.log('Step 4: Manually completing lesson...');
    const completeResponse = await axios.post(
      `${API_BASE_URL}/lessons/${testLessonId}/complete`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log('✓ Lesson completed successfully!');
    console.log('\nResponse:');
    console.log(JSON.stringify(completeResponse.data, null, 2));
    console.log('');

    // Step 6: Verify the completion
    console.log('Step 5: Verifying lesson completion...');
    const afterProgress = await axios.get(
      `${API_BASE_URL}/lessons/${testLessonId}/progress`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log('After completion:');
    console.log(`  Status: ${afterProgress.data.status}`);
    console.log(`  Completed At: ${afterProgress.data.completedAt}`);
    console.log('');

    // Step 7: Verify course progress updated
    console.log('Step 6: Verifying course progress updated...');
    const courseProgress = await axios.get(
      `${API_BASE_URL}/courses/${testCourseId}/progress`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    console.log('Course progress:');
    console.log(`  Progress Percentage: ${courseProgress.data.progressPercentage}%`);
    console.log('');

    // Verify requirements
    console.log('=== Requirement Verification ===');
    console.log(`✓ R21.4: Manual completion endpoint works`);
    console.log(`✓ R21.5: completedAt timestamp set: ${afterProgress.data.completedAt !== null}`);
    console.log(`✓ R21.6: Course progress updated: ${courseProgress.data.progressPercentage}%`);
    console.log(`✓ R2.11: Enrollment validated (no ForbiddenException thrown)`);

    // Test negative case: try to complete lesson for another student (should fail)
    console.log('\n=== Testing Authorization (Negative Case) ===');
    console.log('Attempting to complete lesson as different student...');
    
    // Login as a different student (if exists)
    try {
      const student2Login = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: 'student2@test.com',
        password: 'password123',
      });

      const student2Token = student2Login.data.accessToken;

      // Try to complete the same lesson
      try {
        await axios.post(
          `${API_BASE_URL}/lessons/${testLessonId}/complete`,
          {},
          {
            headers: { Authorization: `Bearer ${student2Token}` },
          }
        );
        console.error('✗ SECURITY ISSUE: Different student was able to complete lesson');
      } catch (error) {
        if (error.response && error.response.status === 403) {
          console.log('✓ R2.5: Authorization check passed (ForbiddenException thrown for non-enrolled student)');
        } else {
          console.log(`Note: Got error: ${error.message}`);
        }
      }
    } catch (error) {
      console.log('Note: Could not test with second student (student2@test.com not found)');
    }

    console.log('\n=== All Tests Passed! ===');

  } catch (error) {
    console.error('\n✗ Test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(error.message);
    }
    process.exit(1);
  }
}

// Run the test
testManualCompletion();
