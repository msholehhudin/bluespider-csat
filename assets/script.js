
/**
 * Bluespider CAST
 * Vanilla JavaScript — no framework required.
 */

// Empty means use the current domain.
// Example when your API bridge is on another domain:
// const API_BASE_URL = "https://api.example.com";
const API_BASE_URL = "https://demo-crm.aosgraha.com";

const API_PREFIX = "/api/public/csat";

const ratingButtons = [
  ...document.querySelectorAll(".star"),
];

const ratingInput = document.getElementById("rating");
const ratingHint = document.getElementById("rating-hint");
const feedbackInput = document.getElementById("feedback");
const characterCount = document.getElementById("character-count");
const form = document.getElementById("feedback-form");
const submitButton = document.getElementById("submit-button");
const submitLabel = document.getElementById("submit-label");
const formMessage = document.getElementById("form-message");

const ratingLabels = {
  1: "Very poor — we're sorry to hear that",
  2: "Poor — we appreciate your honesty",
  3: "Average — thank you for your feedback",
  4: "Good — we're glad to hear that",
  5: "Excellent — thank you for your support!",
};

let selectedRating = 0;
let isSubmitting = false;
let isSubmitted = false;

/**
 * Supports both:
 * /cast/TOKEN
 * /cast/?token=TOKEN
 */
function getRequestToken() {
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get("token");

  if (queryToken) {
    return queryToken.trim();
  }

  const segments = window.location.pathname
    .split("/")
    .filter(Boolean);

  // Supports /cast/TOKEN and /cast/index.html?token=...
  // change to csat
  const castIndex = segments.findIndex(
    (segment) => segment.toLowerCase() === "csat"
  );

  if (castIndex >= 0 && segments[castIndex + 1]) {
    const nextSegment = segments[castIndex + 1];

    if (nextSegment.toLowerCase() !== "index.html") {
      try {
        return decodeURIComponent(nextSegment).trim();
      } catch {
        return "";
      }
    }
  }

  return "";
}

const requestToken = getRequestToken();

console.log("Current URL:", window.location.href);
console.log("Request Token:", requestToken);

function showMessage(message, type = "error") {
  formMessage.textContent = message;
  formMessage.className = `message ${type}`;
  formMessage.hidden = false;
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.hidden = true;
  formMessage.className = "message";
}

function setRating(rating) {
  if (isSubmitting || isSubmitted) return;

  selectedRating = rating;
  ratingInput.value = String(rating);
  ratingHint.textContent = ratingLabels[rating];

  ratingButtons.forEach((button) => {
    const value = Number(button.dataset.rating);
    const isActive = value <= rating;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(value === rating));
  });

  clearMessage();
}

ratingButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setRating(Number(button.dataset.rating));
  });
});

feedbackInput.addEventListener("input", () => {
  characterCount.textContent =
    `${feedbackInput.value.length}/1000`;
});

function setLoading(loading) {
  isSubmitting = loading;
  submitButton.disabled = loading || isSubmitted;

  ratingButtons.forEach((button) => {
    button.disabled = loading || isSubmitted;
  });

  feedbackInput.disabled = loading || isSubmitted;

  submitLabel.textContent = loading
    ? "Submitting..."
    : isSubmitted
      ? "Feedback submitted"
      : "Submit feedback";
}

function getApiUrl() {
  const base = API_BASE_URL.replace(/\/+$/, "");
  return `${base}${API_PREFIX}`;
}

async function submitFeedback() {
  const apiUrl = getApiUrl();
  const endpoint =
    `${apiUrl}/requests/${encodeURIComponent(requestToken)}/responses`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      rating: selectedRating,
      feedback: feedbackInput.value.trim(),
    }),
  });

  let result = {};

  try {
    result = await response.json();
  } catch {
    // The server may return an empty or non-JSON response.
  }

  if (!response.ok) {
    if (response.status === 409) {
      throw new Error(
        "Feedback for this request has already been submitted."
      );
    }

    if (response.status === 410) {
      throw new Error(
        "This feedback link has expired. Please contact customer service."
      );
    }

    if (response.status === 422) {
      throw new Error(
        result.message ||
          "Please check your rating and feedback, then try again."
      );
    }

    if (response.status === 429) {
      throw new Error(
        "Too many attempts. Please wait a moment before trying again."
      );
    }

    throw new Error(
      result.message ||
        "We couldn't submit your feedback. Please try again."
    );
  }

  return result;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSubmitting || isSubmitted) return;

  clearMessage();

  if (!selectedRating) {
    showMessage("Please select a star rating before submitting.");
    document.getElementById("star-rating").scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    return;
  }

  if (!requestToken) {
    showMessage(
      "This feedback link is missing its request token. Please open the original link from WhatsApp."
    );
    return;
  }

  setLoading(true);

  try {
    await submitFeedback();

    isSubmitted = true;
    setLoading(false);

    showMessage(
      "Thank you! Your feedback has been submitted successfully.",
      "success"
    );

    // Prevent accidental resubmission in this page session.
    form.querySelector(".rating-field").setAttribute(
      "aria-disabled",
      "true"
    );
  } catch (error) {
    setLoading(false);

    showMessage(
      error instanceof TypeError
        ? "We couldn't connect to the feedback service. Please check your connection and try again."
        : error.message || "Something went wrong. Please try again."
    );
  }
});
