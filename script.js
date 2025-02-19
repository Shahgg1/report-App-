document.addEventListener("DOMContentLoaded", () => {
  // --- Simulated User Data Storage ---
  let users = [];
  let currentUser = null;
  let generatedReportContent = ""; // Holds the generated report text

  // --- Helper Functions ---
  const showElement = (id) => {
    document.getElementById(id).classList.remove("hidden");
  };
  const hideElement = (id) => {
    document.getElementById(id).classList.add("hidden");
  };

  // --- Toggle between Login and Signup Forms ---
  document.getElementById("show-signup").addEventListener("click", (e) => {
    e.preventDefault();
    hideElement("login-form");
    showElement("signup-form");
  });
  document.getElementById("show-login").addEventListener("click", (e) => {
    e.preventDefault();
    hideElement("signup-form");
    showElement("login-form");
  });

  // --- Sign Up Process ---
  document.getElementById("signup-btn").addEventListener("click", () => {
    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    if (!name || !email || !password) {
      alert("Please fill in all fields.");
      return;
    }
    // Prevent duplicate registration
    if (users.find(u => u.email === email)) {
      alert("Email already registered. Please log in.");
      return;
    }
    users.push({ name, email, password });
    alert("Sign up successful! Please log in.");
    hideElement("signup-form");
    showElement("login-form");
  });

  // --- Login Process ---
  document.getElementById("login-btn").addEventListener("click", () => {
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      alert("Invalid email or password.");
      return;
    }
    currentUser = user;
    localStorage.setItem("currentUser", JSON.stringify(user));
    switchToApp();
  });

  function switchToApp() {
    hideElement("auth-container");
    showElement("app-container");
  }

  // --- Logout Process ---
  document.getElementById("logout-btn").addEventListener("click", () => {
    currentUser = null;
    localStorage.removeItem("currentUser");
    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
    hideElement("app-container");
    showElement("auth-container");
  });

  // --- Auto Sign-In if User Data Exists ---
  const storedUser = localStorage.getItem("currentUser");
  if (storedUser) {
    currentUser = JSON.parse(storedUser);
    switchToApp();
  }

  // --- Helper: Basic Tokenization and Jaccard Similarity ---
  function tokenize(text) {
    return text.toLowerCase().match(/\w+/g) || [];
  }

  // Returns Jaccard similarity between two sets
  function jaccardSimilarity(setA, setB) {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
  }

  // --- Generate Report Based on PDF Content Using NLP ---
  document.getElementById("generate-report").addEventListener("click", () => {
    const promptText = document.getElementById("user-prompt").value.trim();
    if (!promptText) {
      alert("Please enter a prompt.");
      return;
    }
    
    // Ensure a PDF is attached
    const pdfInput = document.getElementById("pdf-upload");
    if (pdfInput.files.length === 0) {
      alert("Please attach a PDF file.");
      return;
    }
    
    const pdfFile = pdfInput.files[0];
    const reader = new FileReader();
    
    reader.onload = function() {
      // Convert PDF file data to an ArrayBuffer
      const typedarray = new Uint8Array(this.result);
      
      pdfjsLib.getDocument(typedarray).promise.then(pdf => {
        let totalPages = pdf.numPages;
        let extractedText = "";
        let pagesProcessed = 0;
        
        // Process each page to extract text
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          pdf.getPage(pageNum).then(page => {
            page.getTextContent().then(textContent => {
              // Join text items into a single string for the page
              let pageText = textContent.items.map(item => item.str).join(" ");
              extractedText += " " + pageText;
              pagesProcessed++;
              
              // Once all pages are processed, perform NLP-based extraction
              if (pagesProcessed === totalPages) {
                // Split extracted text into sentences (using period as delimiter)
                const sentences = extractedText.split(/(?<=[.?!])\s+/);
                const promptTokens = new Set(tokenize(promptText));
                
                // Score each sentence using Jaccard similarity between its tokens and the prompt's tokens
                const scoredSentences = sentences.map(sentence => {
                  const sentenceTokens = new Set(tokenize(sentence));
                  const similarity = jaccardSimilarity(promptTokens, sentenceTokens);
                  return { sentence, similarity };
                });
                
                // Filter out sentences with very low similarity and sort by similarity descending
                const relevantSentences = scoredSentences
                  .filter(item => item.similarity > 0.1)
                  .sort((a, b) => b.similarity - a.similarity)
                  .map(item => item.sentence);
                
                let resultText = "";
                if (relevantSentences.length > 0) {
                  resultText = relevantSentences.join("\n");
                } else {
                  resultText = "No relevant information found in the PDF for the given prompt.";
                }
                
                // Build final report content
                generatedReportContent =
                  "=== AI-Generated Report ===\n\n" +
                  "Prompt: " + promptText + "\n\n" +
                  "Extracted Information:\n" + resultText +
                  "\n\nGenerated on: " + new Date().toLocaleString();
                
                // Update the preview area
                document.getElementById("report-content").innerText = generatedReportContent;
              }
            });
          });
        }
      }).catch(error => {
        console.error("Error reading PDF: ", error);
        alert("There was an error processing the PDF. Please try again.");
      });
    };
    
    reader.readAsArrayBuffer(pdfFile);
  });

  // --- Download Report as PDF Using jsPDF ---
  document.getElementById("download-report").addEventListener("click", () => {
    if (!generatedReportContent.trim()) {
      alert("No report available. Please generate a report first.");
      return;
    }
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      // Wrap text within 180 units width
      const lines = doc.splitTextToSize(generatedReportContent, 180);
      doc.text(lines, 10, 20);
      doc.save(`AI_Report_${Date.now()}.pdf`);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("There was an error generating the PDF. Please try again.");
    }
  });
});