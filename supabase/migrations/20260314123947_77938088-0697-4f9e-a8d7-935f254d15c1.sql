-- Deactivate the incorrectly allocated US proxy subscription
UPDATE subscriptions SET status = 'cancelled', cancelled_at = now() WHERE name = 'WS-MMQB3GKB' AND user_id = '51d84540-066d-4f6d-b06b-a4c6156474c3';

-- Link the new BR proxy subscription to the same product
UPDATE subscriptions SET product_id = '1a882c20-2d66-492f-8b64-3f150b15d586' WHERE name = 'WS-MMQBBY4G' AND user_id = '51d84540-066d-4f6d-b06b-a4c6156474c3';