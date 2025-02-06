import vm from 'vm';
import { questions } from '../utils/questions';

function evaluateUserCode(userCode, questionId) {
  const question = questions.find(q => q.id === questionId);
  if (!question) {
      return { error: "Invalid question ID" };
  }

  const functionName = question.functionSignature.match(/function (\w+)/)[1]; 
  const testCases = question.testCases;

  let results = {
      passed: 0,
      failed: 0,
      details: []
  };

  try {
      const sandbox = { 
          console: { log: () => {} },  
          JSON,  
          Math   
      };
      vm.createContext(sandbox);

      const wrappedCode = `
          ${userCode}
          this.${functionName} = ${functionName};
      `;
      
      vm.runInContext(wrappedCode, sandbox);

      for (const testCase of testCases) {
          try {
              const userOutput = vm.runInContext(`${functionName}(${JSON.stringify(testCase.input)})`, sandbox);
              const expectedOutput = testCase.expected;

              if (JSON.stringify(userOutput) === JSON.stringify(expectedOutput)) {
                  results.passed++;
                  results.details.push({ 
                      input: testCase.input, 
                      expected: expectedOutput, 
                      result: userOutput, 
                      status: "Passed" 
                  });
              } else {
                  results.failed++;
                  results.details.push({ 
                      input: testCase.input, 
                      expected: expectedOutput, 
                      result: userOutput, 
                      status: "Failed" 
                  });
              }
          } catch (testCaseError) {
              results.failed++;
              results.details.push({
                  input: testCase.input,
                  expected: testCase.expected,
                  result: testCaseError.message,
                  status: "Failed"
              });
          }
      }
  } catch (error) {
      return { error: "Code execution failed", message: error.message };
  }

  return results;
}

export { evaluateUserCode };