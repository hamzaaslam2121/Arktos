export function initQuickQuotes(options) {
    const { userId } = options;
    console.log("USER ID:" + userId)
    document.addEventListener('DOMContentLoaded', () => {
      const stripe = Stripe('pk_test_51OddvpG2vb5Xhm5fmHYLmRtMlZE1syE8oI4ohzhNcU7hdxRYY8hcV98pQNuVVTs4iaJjoxXhKwcXzCUvgdkrwqbi00ALKz3pW8');
      const form = document.getElementById('parcelForm');
      const pickupInput = document.getElementById('pickup');
      const destinationInput = document.getElementById('destination');
      const pickupPostcodeInput = document.getElementById('pickupPostcode');
      const destinationPostcodeInput = document.getElementById('destinationPostcode');
      const pickupSuggestions = document.getElementById('pickupSuggestions');
      const destinationSuggestions = document.getElementById('destinationSuggestions');
      const distanceInfo = document.getElementById('distance-info');
      const distanceValue = document.getElementById('distance-value');
      const priceInfo = document.getElementById('price-info');
      const priceElement = document.getElementById('price-value');
      const weightInput = document.getElementById('weight');
      const serviceLevelSelect = document.getElementById('serviceLevel');
      const shippingTypeSelect = document.getElementById('shippingType');
      let calculatedDistance = 0;
      const quoteButton = document.getElementById('quoteButton');

      // Modified Autocomplete initialization to restrict to UK addresses
      const autocompleteOptions = {
        types: ['address'],
        componentRestrictions: { country: 'gb' } // 'gb' is the country code for the United Kingdom
      };

      // Keep Google Maps Autocomplete for optional address fields
      const pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, autocompleteOptions);
      const destinationAutocomplete = new google.maps.places.Autocomplete(destinationInput, autocompleteOptions);

      // Postcode suggestions function remains the same
      // Update the postcode suggestions function
      async function fetchPostcodeSuggestions(query, suggestionsList) {
        if (query.length < 2) {
          suggestionsList.innerHTML = '';
          suggestionsList.classList.add('hidden');
          return;
        }

        try {
          const response = await fetch(`/api/postcode-suggestions?q=${encodeURIComponent(query)}`);
          if (!response.ok) throw new Error('Failed to fetch suggestions');
          
          const suggestions = await response.json();
          
          suggestionsList.innerHTML = '';
          suggestions.forEach(postcode => {
            const li = document.createElement('li');
            li.textContent = postcode;
            li.className = 'px-3 py-2 hover:bg-gray-700 cursor-pointer'; // Updated class
            li.onclick = () => {
              const input = suggestionsList.id === 'pickupSuggestions' ? pickupPostcodeInput : destinationPostcodeInput;
              input.value = postcode;
              suggestionsList.classList.add('hidden');
              calculateDistance(); // Trigger distance calculation when postcode is selected
            };
            suggestionsList.appendChild(li);
          });
          
          suggestionsList.classList.remove('hidden');
        } catch (error) {
          console.error('Error fetching postcode suggestions:', error);
        }
      }

      // Modified calculateDistance function to use postcodes
      async function calculateDistance() {
        const pickup = pickupPostcodeInput.value.trim();
        const destination = destinationPostcodeInput.value.trim();
        
        if (pickup && destination) {
          try {
            const response = await fetch(`/api/calculate-distance?origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(destination)}`);
            if (!response.ok) throw new Error(`Failed to calculate distance: ${response.status} ${response.statusText}`);
            
            const data = await response.json();
            
            if (data.distance) {
              calculatedDistance = parseFloat(data.distance);
              distanceValue.textContent = `${data.distance} ${data.unit}`;
              updatePrice();
            } else {
              throw new Error('Invalid distance data');
            }
          } catch (error) {
            console.error('Error calculating distance:', error);
            distanceInfo.classList.add('hidden');
            priceInfo.classList.add('hidden');
            priceElement.textContent = 'N/A';
          }
        } else {
          distanceInfo.classList.add('hidden');
          priceInfo.classList.add('hidden');
          priceElement.textContent = 'N/A';
        }
      }

      function calculatePrice() {
        const distance = calculatedDistance;
        const weight = parseFloat(weightInput.value) || 0;
        const serviceLevel = serviceLevelSelect.value;
        const shippingType = shippingTypeSelect.value;

        // Updated base price for GBP (assuming £0.10 per mile + £2 base charge)
        let price = (distance * 0.1) + 2;
        price += weight * 0.2;

        if (serviceLevel === 'express') {
          price *= 1.5;
        } else if (serviceLevel === 'nextDay') {
          price *= 2;
        }

        if (shippingType === 'document') {
          price *= 0.8;
        } else if (shippingType === 'pallet') {
          price *= 2.5;
        }

        return price.toFixed(2);
      }

      function updatePrice() {
        if (pickupPostcodeInput.value && destinationPostcodeInput.value && weightInput.value && calculatedDistance > 0) {
          const price = calculatePrice();
          priceElement.textContent = price;
          priceInfo.classList.remove('hidden');
          
          // Enable/disable button based on price
          const numericPrice = parseFloat(price);
          quoteButton.disabled = isNaN(numericPrice) || numericPrice <= 0;
          
          // Update button styles based on state
          if (quoteButton.disabled) {
            quoteButton.classList.add('opacity-50', 'cursor-not-allowed');
          } else {
            quoteButton.classList.remove('opacity-50', 'cursor-not-allowed');
          }
        } else {
          priceElement.textContent = 'N/A';
          priceInfo.classList.add('hidden');
          quoteButton.disabled = true;
          quoteButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
      }
      function pingServer() {
        fetch('/api/ping')
          .then(response => response.json())
          .catch(error => console.error('Ping failed:', error));
      }
      // Ping every 5 minutes
      setInterval(pingServer, 60 * 1000);
      // Initial ping when the page loads
      pingServer();

      let debounceTimer;
      function debounce(func, delay) {
        return function() {
          const context = this;
          const args = arguments;
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => func.apply(context, args), delay);
        }
      }

      // Modified event listeners to use postcode inputs for distance calculation
      pickupPostcodeInput.addEventListener('input', debounce(() => {
        fetchPostcodeSuggestions(pickupPostcodeInput.value, pickupSuggestions);
        calculateDistance();
      }, 300));

      destinationPostcodeInput.addEventListener('input', debounce(() => {
        fetchPostcodeSuggestions(destinationPostcodeInput.value, destinationSuggestions);
        calculateDistance();
      }, 300));

      // Remove distance calculation from address input listeners
      weightInput.addEventListener('input', updatePrice);
      serviceLevelSelect.addEventListener('change', updatePrice);
      shippingTypeSelect.addEventListener('change', updatePrice);

      // Hide suggestions when clicking outside
      document.addEventListener('click', (e) => {
        if (!pickupPostcodeInput.contains(e.target)) {
          pickupSuggestions.classList.add('hidden');
        }
        if (!destinationPostcodeInput.contains(e.target)) {
          destinationSuggestions.classList.add('hidden');
        }
      });

      // Form submission handler remains the same
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

      // Get current datetime in dd/mm/yyyy hh:mm:ss format
      const now = new Date();
      const datetime = now.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-');

      const formData = {
        user: userId || 'anonymous',
        pickup: pickupInput.value || pickupPostcodeInput.value,
        destination: destinationInput.value || destinationPostcodeInput.value,
        price: parseFloat(priceElement.textContent) || 0,
        distance: calculatedDistance,
        completed: 0,
        serviceLevel: serviceLevelSelect.value,
        shippingType: shippingTypeSelect.value,
        weight: parseFloat(weightInput.value) || 0,
        datetime: datetime  // Add this line
      };

        console.log('Submitting form data:', formData);

        try {
          const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
          });

          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

          const { sessionId } = await response.json();

          const result = await stripe.redirectToCheckout({
            sessionId: sessionId
          });

          if (result.error) {
            alert(result.error.message);
          }
        } catch (error) {
          console.error('Error:', error);
          alert('Error creating checkout session: ' + (error instanceof Error ? error.message : String(error)));
        }
      });
    });
}