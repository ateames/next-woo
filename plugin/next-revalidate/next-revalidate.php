<?php
/**
 * Plugin Name: Next.js Revalidation
 * Description: Revalidates Next.js site when WordPress content changes
 * Version: 1.0.5
 * Author: 9d8
 * Author URI: https://9d8.dev
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

class Next_Revalidation {
    private $options;
    private $option_name = 'next_revalidation_settings';
    private $last_revalidation = 0;
    private $revalidation_cooldown = 2; // seconds between revalidations
    private $history_option_name = 'next_revalidation_history';
    private $max_history_items = 50;

    public function __construct() {
        // Initialize plugin
        add_action('init', array($this, 'init'));
        // Register AJAX actions for manual revalidation
        add_action('init', array($this, 'register_ajax_actions'));
        
        // Register settings
        add_action('admin_init', array($this, 'register_settings'));
        
        // Add admin menu
        add_action('admin_menu', array($this, 'add_admin_menu'));
        
        // Post save/update hooks - any post status change
        add_action('transition_post_status', array($this, 'on_post_status_change'), 10, 3);
        add_action('save_post', array($this, 'on_content_change'), 10, 3);
        
        // Trash and delete hooks with higher priority to ensure they run
        add_action('trashed_post', array($this, 'on_post_trash'), 5);
        add_action('untrashed_post', array($this, 'on_post_untrash'), 5);
        add_action('delete_post', array($this, 'on_post_delete'), 5);
        add_action('after_delete_post', array($this, 'on_post_delete'), 5);
        
        // Term changes
        add_action('created_term', array($this, 'on_term_change'), 10, 3);
        add_action('edited_term', array($this, 'on_term_change'), 10, 3);
        add_action('delete_term', array($this, 'on_term_change'), 10, 3);
        
        // User changes
        add_action('profile_update', array($this, 'on_user_change'), 10);
        add_action('user_register', array($this, 'on_user_change'), 10);
        add_action('deleted_user', array($this, 'on_user_change'), 10);
        
        // Media changes
        add_action('add_attachment', array($this, 'on_media_change'), 10);
        add_action('edit_attachment', array($this, 'on_media_change'), 10);
        add_action('delete_attachment', array($this, 'on_media_change'), 10);
        
        // Menu changes
        add_action('wp_update_nav_menu', array($this, 'on_menu_change'), 10);
        add_action('wp_create_nav_menu', array($this, 'on_menu_change'), 10);
        add_action('wp_delete_nav_menu', array($this, 'on_menu_change'), 10);

        // Shop catalog: excluded tags, landing page meta, REST
        add_action('rest_api_init', array($this, 'register_rest_routes'));
        add_action('init', array($this, 'register_page_meta'));
        add_action('add_meta_boxes', array($this, 'add_page_meta_box'));
        add_action('save_post_page', array($this, 'save_page_product_tag_meta'), 10, 2);
        add_action('update_option_' . $this->option_name, array($this, 'on_settings_updated'), 10, 2);

        if (class_exists('WooCommerce')) {
            add_filter('woocommerce_rest_product_collection_params', array($this, 'add_tag_exclude_collection_param'));
            add_filter('woocommerce_rest_product_query', array($this, 'apply_tag_exclude_product_query'), 10, 2);
        }
    }

    public function init() {
        $this->options = get_option($this->option_name);
    }

    public function register_settings() {
        register_setting(
            'next_revalidation_group',
            $this->option_name,
            array($this, 'sanitize_settings')
        );

        add_settings_section(
            'next_revalidation_section',
            'Next.js Revalidation Settings',
            array($this, 'settings_section_callback'),
            'next-revalidation-settings'
        );

        add_settings_field(
            'next_url',
            'Next.js Site URL',
            array($this, 'next_url_callback'),
            'next-revalidation-settings',
            'next_revalidation_section'
        );

        add_settings_field(
            'webhook_secret',
            'Webhook Secret',
            array($this, 'webhook_secret_callback'),
            'next-revalidation-settings',
            'next_revalidation_section'
        );
        
        add_settings_field(
            'enable_notifications',
            'Enable Notifications',
            array($this, 'enable_notifications_callback'),
            'next-revalidation-settings',
            'next_revalidation_section'
        );
        
        add_settings_field(
            'revalidation_cooldown',
            'Revalidation Cooldown',
            array($this, 'revalidation_cooldown_callback'),
            'next-revalidation-settings',
            'next_revalidation_section'
        );

        add_settings_section(
            'next_shop_section',
            'Headless Shop Settings',
            array($this, 'shop_settings_section_callback'),
            'next-revalidation-settings'
        );

        add_settings_field(
            'shop_excluded_product_tags',
            'Excluded product tags (main shop)',
            array($this, 'shop_excluded_product_tags_callback'),
            'next-revalidation-settings',
            'next_shop_section'
        );
    }

    public function sanitize_settings($input) {
        $new_input = array();
        
        if (isset($input['next_url'])) {
            // Normalize and sanitize Next.js site URL (remove trailing slash)
            $url = rtrim(trim($input['next_url']), '/');
            $new_input['next_url'] = esc_url_raw($url);
        }
        
        if(isset($input['webhook_secret'])) {
            $new_input['webhook_secret'] = sanitize_text_field($input['webhook_secret']);
        }
        
        if(isset($input['enable_notifications'])) {
            $new_input['enable_notifications'] = (bool)$input['enable_notifications'];
        }
        
        if(isset($input['revalidation_cooldown'])) {
            $cooldown = intval($input['revalidation_cooldown']);
            $new_input['revalidation_cooldown'] = max(0, min(60, $cooldown)); // Between 0 and 60 seconds
        }

        if (isset($input['shop_excluded_product_tags'])) {
            $new_input['shop_excluded_product_tags'] = sanitize_text_field($input['shop_excluded_product_tags']);
        }
        
        return $new_input;
    }

    public function settings_section_callback() {
        echo '<p>Configure the connection to your Next.js site for revalidation.</p>';
    }

    public function next_url_callback() {
        $value = isset($this->options['next_url']) ? esc_attr($this->options['next_url']) : '';
        echo '<input type="url" id="next_url" name="' . $this->option_name . '[next_url]" value="' . $value . '" class="regular-text" placeholder="https://your-next-site.com" />';
        echo '<p class="description">Your Next.js site URL without trailing slash.</p>';
    }

    public function webhook_secret_callback() {
        $value = isset($this->options['webhook_secret']) ? esc_attr($this->options['webhook_secret']) : '';
        echo '<input type="text" id="webhook_secret" name="' . $this->option_name . '[webhook_secret]" value="' . $value . '" class="regular-text" />';
        echo '<p class="description">This should match the WORDPRESS_WEBHOOK_SECRET in your Next.js environment.</p>';
    }

    public function enable_notifications_callback() {
        $value = isset($this->options['enable_notifications']) ? (bool)$this->options['enable_notifications'] : false;
        echo '<input type="checkbox" id="enable_notifications" name="' . $this->option_name . '[enable_notifications]" ' . checked($value, true, false) . ' />';
        echo '<label for="enable_notifications">Show admin notifications for revalidation events</label>';
    }
    
    public function revalidation_cooldown_callback() {
        $value = isset($this->options['revalidation_cooldown']) ? intval($this->options['revalidation_cooldown']) : 2;
        echo '<input type="number" min="0" max="60" id="revalidation_cooldown" name="' . $this->option_name . '[revalidation_cooldown]" value="' . $value . '" class="small-text" />';
        echo '<p class="description">Minimum seconds between revalidation requests (0-60). Use higher values for busy sites.</p>';
    }

    public function shop_settings_section_callback() {
        echo '<p>Control which WooCommerce product tags are hidden from the main Next.js shop and home featured products. Use comma-separated tag slugs (from <strong>Products → Tags</strong>).</p>';
    }

    public function shop_excluded_product_tags_callback() {
        $value = isset($this->options['shop_excluded_product_tags']) ? esc_attr($this->options['shop_excluded_product_tags']) : '';
        echo '<input type="text" id="shop_excluded_product_tags" name="' . $this->option_name . '[shop_excluded_product_tags]" value="' . $value . '" class="large-text" placeholder="custom, wholesale" />';
        echo '<p class="description">Products with these tags stay off <code>/shop</code> but can appear on tag landing pages.</p>';
    }

    public function register_rest_routes() {
        register_rest_route('next-woo/v1', '/shop-settings', array(
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => array($this, 'get_shop_settings_rest'),
        ));
    }

    public function get_shop_settings_rest() {
        return array(
            'excluded_product_tags' => $this->get_excluded_product_tag_slugs(),
        );
    }

    private function get_excluded_product_tag_slugs() {
        $options = get_option($this->option_name, array());
        $raw = isset($options['shop_excluded_product_tags']) ? $options['shop_excluded_product_tags'] : '';
        if ($raw === '') {
            return array();
        }
        $slugs = array_map('trim', explode(',', $raw));
        $slugs = array_map('sanitize_title', $slugs);
        $slugs = array_filter($slugs);
        return array_values(array_unique($slugs));
    }

    public function on_settings_updated($old_value, $value) {
        $this->send_revalidation_request('shop_settings', null);
    }

    public function register_page_meta() {
        register_post_meta('page', 'product_tag_slug', array(
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => '',
            'sanitize_callback' => 'sanitize_title',
            'auth_callback' => function () {
                return current_user_can('edit_pages');
            },
        ));
    }

    public function add_page_meta_box() {
        add_meta_box(
            'next_woo_product_tag',
            'Headless Shop — Product tag',
            array($this, 'render_page_product_tag_meta_box'),
            'page',
            'side',
            'default'
        );
    }

    public function render_page_product_tag_meta_box($post) {
        wp_nonce_field('next_woo_product_tag_meta', 'next_woo_product_tag_nonce');
        $value = get_post_meta($post->ID, 'product_tag_slug', true);
        echo '<p><label for="product_tag_slug">WooCommerce product tag slug</label></p>';
        echo '<input type="text" id="product_tag_slug" name="product_tag_slug" value="' . esc_attr($value) . '" class="widefat" placeholder="custom" />';
        echo '<p class="description">When set, this page is served at <code>/' . esc_html($post->post_name) . '</code> with only products that have this tag. Leave empty for a normal content page at <code>/pages/' . esc_html($post->post_name) . '</code>.</p>';
    }

    public function save_page_product_tag_meta($post_id, $post) {
        if (!isset($_POST['next_woo_product_tag_nonce']) || !wp_verify_nonce($_POST['next_woo_product_tag_nonce'], 'next_woo_product_tag_meta')) {
            return;
        }
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) {
            return;
        }
        if (!current_user_can('edit_page', $post_id)) {
            return;
        }
        $slug = isset($_POST['product_tag_slug']) ? sanitize_title($_POST['product_tag_slug']) : '';
        update_post_meta($post_id, 'product_tag_slug', $slug);
        $this->send_revalidation_request('page', $post_id);
    }

    public function add_tag_exclude_collection_param($params) {
        $params['tag_exclude'] = array(
            'description' => __('Exclude products assigned specific tag IDs (comma-separated).', 'next-revalidate'),
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        );
        return $params;
    }

    public function apply_tag_exclude_product_query($args, $request) {
        $tag_exclude = $request->get_param('tag_exclude');
        if (empty($tag_exclude)) {
            return $args;
        }

        $tag_ids = array_filter(array_map('absint', explode(',', $tag_exclude)));
        if (empty($tag_ids)) {
            return $args;
        }

        $tax_query = isset($args['tax_query']) ? $args['tax_query'] : array();
        $tax_query[] = array(
            'taxonomy' => 'product_tag',
            'field' => 'term_id',
            'terms' => $tag_ids,
            'operator' => 'NOT IN',
        );
        $args['tax_query'] = $tax_query;

        return $args;
    }

    public function add_admin_menu() {
        add_menu_page(
            'Next.js Revalidation',
            'Next.js',
            'manage_options',
            'next-revalidation-settings',
            array($this, 'admin_page_content'),
            'dashicons-update', // WordPress dashicon
            100 // Position in menu
        );
        
        // Add submenu pages
        add_submenu_page(
            'next-revalidation-settings',
            'Settings',
            'Settings',
            'manage_options',
            'next-revalidation-settings'
        );
        
        add_submenu_page(
            'next-revalidation-settings',
            'Revalidation History',
            'History',
            'manage_options',
            'next-revalidation-history',
            array($this, 'history_page_content')
        );
    }

    public function admin_page_content() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form method="post" action="options.php">
                <?php
                settings_fields('next_revalidation_group');
                do_settings_sections('next-revalidation-settings');
                submit_button('Save Settings');
                ?>
            </form>
            <hr>
            <h2>Manual Revalidation</h2>
            <p>Click the button below to manually trigger a full revalidation of your Next.js site.</p>
            <button id="manual-revalidate" class="button button-primary">Revalidate All Content</button>
            <div id="revalidation-result" style="margin-top: 10px;"></div>
            
            <script>
                jQuery(document).ready(function($) {
                    $('#manual-revalidate').on('click', function(e) {
                        e.preventDefault();
                        
                        $(this).prop('disabled', true).text('Revalidating...');
                        $('#revalidation-result').html('');
                        
                        $.ajax({
                            url: ajaxurl,
                            type: 'POST',
                            data: {
                                action: 'manual_revalidation',
                                nonce: '<?php echo wp_create_nonce('next_revalidation_nonce'); ?>'
                            },
                            success: function(response) {
                                $('#revalidation-result').html('<div class="notice notice-success inline"><p>' + response.data + '</p></div>');
                                $('#manual-revalidate').prop('disabled', false).text('Revalidate All Content');
                            },
                            error: function() {
                                $('#revalidation-result').html('<div class="notice notice-error inline"><p>Failed to revalidate. Please check your settings and try again.</p></div>');
                                $('#manual-revalidate').prop('disabled', false).text('Revalidate All Content');
                            }
                        });
                    });
                });
            </script>
        </div>
        <?php
    }
    
    public function history_page_content() {
        // Get revalidation history
        $history = get_option($this->history_option_name, array());
        
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            
            <div class="tablenav top">
                <div class="alignleft actions">
                    <form method="post" action="">
                        <?php wp_nonce_field('clear_revalidation_history', 'clear_history_nonce'); ?>
                        <input type="hidden" name="action" value="clear_history">
                        <input type="submit" class="button" value="Clear History" onclick="return confirm('Are you sure you want to clear the revalidation history?');">
                    </form>
                </div>
                <br class="clear">
            </div>
            
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Content Type</th>
                        <th>Content ID</th>
                        <th>Status</th>
                        <th>Response</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($history)): ?>
                        <tr>
                            <td colspan="5">No revalidation history found.</td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($history as $entry): ?>
                            <tr>
                                <td><?php echo esc_html(date('Y-m-d H:i:s', $entry['time'])); ?></td>
                                <td><?php echo esc_html($entry['content_type']); ?></td>
                                <td><?php echo isset($entry['content_id']) ? esc_html($entry['content_id']) : 'N/A'; ?></td>
                                <td>
                                    <?php if ($entry['success']): ?>
                                        <span style="color: green;">Success</span>
                                    <?php else: ?>
                                        <span style="color: red;">Failed</span>
                                    <?php endif; ?>
                                </td>
                                <td>
                                    <?php 
                                    if (isset($entry['response'])) {
                                        echo esc_html(substr($entry['response'], 0, 50));
                                        if (strlen($entry['response']) > 50) {
                                            echo '...';
                                        }
                                    } else {
                                        echo 'N/A';
                                    }
                                    ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php
        
        // Handle clear history action
        if (isset($_POST['action']) && $_POST['action'] === 'clear_history') {
            if (check_admin_referer('clear_revalidation_history', 'clear_history_nonce')) {
                delete_option($this->history_option_name);
                echo '<script>window.location.reload();</script>';
            }
        }
    }
    
    // AJAX action for manual revalidation
    public function register_ajax_actions() {
        add_action('wp_ajax_manual_revalidation', array($this, 'handle_manual_revalidation'));
    }
    
    public function handle_manual_revalidation() {
        check_ajax_referer('next_revalidation_nonce', 'nonce');
        
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Permission denied');
            return;
        }
        
        $result = $this->send_revalidation_request('all');
        
        if ($result) {
            wp_send_json_success('Successfully revalidated all content on your Next.js site.');
        } else {
            wp_send_json_error('Failed to revalidate content. Please check your settings.');
        }
    }

    // Triggered when a post changes status (draft, publish, trash, etc.)
    public function on_post_status_change($new_status, $old_status, $post) {
        // Skip if it's a revision or autosave
        if (wp_is_post_revision($post->ID) || wp_is_post_autosave($post->ID)) {
            return;
        }
        
        // If the status is changing, we should revalidate
        if ($new_status !== $old_status) {
            error_log("Next.js Revalidation: Post status changed from {$old_status} to {$new_status} for post {$post->ID}");
            $this->send_revalidation_request($post->post_type, $post->ID);
        }
    }

    public function on_content_change($post_id, $post = null, $update = null) {
        // Don't revalidate on autosave or revision
        if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id)) {
            return;
        }
        
        // Get the post if not provided
        if (null === $post) {
            $post = get_post($post_id);
        }
        
        error_log("Next.js Revalidation: Content changed for post {$post_id}");
        $this->send_revalidation_request($post->post_type, $post_id);
    }

    public function on_post_trash($post_id) {
        $post_type = get_post_type($post_id);
        error_log("Next.js Revalidation: Post trashed {$post_id} of type {$post_type}");
        $this->send_revalidation_request($post_type, $post_id);
    }

    public function on_post_untrash($post_id) {
        $post_type = get_post_type($post_id);
        error_log("Next.js Revalidation: Post untrashed {$post_id} of type {$post_type}");
        $this->send_revalidation_request($post_type, $post_id);
    }

    public function on_post_delete($post_id) {
        $post_type = get_post_type($post_id);
        if (!$post_type) {
            $post_type = 'unknown'; // Fallback if post type can't be determined
        }
        error_log("Next.js Revalidation: Post deleted {$post_id} of type {$post_type}");
        $this->send_revalidation_request($post_type, $post_id);
    }

    public function on_term_change($term_id, $tt_id, $taxonomy) {
        // Map taxonomy to content type
        $content_type = $taxonomy;
        if ($taxonomy === 'category') {
            $content_type = 'category';
        } elseif ($taxonomy === 'post_tag') {
            $content_type = 'tag';
        }
        
        error_log("Next.js Revalidation: Term changed {$term_id} of type {$content_type}");
        $this->send_revalidation_request($content_type, $term_id);
    }

    public function on_user_change($user_id) {
        error_log("Next.js Revalidation: User changed {$user_id}");
        $this->send_revalidation_request('author', $user_id);
    }

    public function on_media_change($attachment_id) {
        error_log("Next.js Revalidation: Media changed {$attachment_id}");
        $this->send_revalidation_request('media', $attachment_id);
    }
    
    public function on_menu_change($menu_id) {
        error_log("Next.js Revalidation: Menu changed {$menu_id}");
        $this->send_revalidation_request('menu', $menu_id);
    }
    
    private function log_revalidation($content_type, $content_id, $success, $response = '') {
        $history = get_option($this->history_option_name, array());
        
        // Add new entry at the beginning
        array_unshift($history, array(
            'time' => time(),
            'content_type' => $content_type,
            'content_id' => $content_id,
            'success' => $success,
            'response' => $response
        ));
        
        // Keep only the last X entries
        if (count($history) > $this->max_history_items) {
            $history = array_slice($history, 0, $this->max_history_items);
        }
        
        update_option($this->history_option_name, $history);
    }

    private function send_revalidation_request($content_type, $content_id = null) {
        // Get cooldown from settings if available
        $cooldown = isset($this->options['revalidation_cooldown']) ? intval($this->options['revalidation_cooldown']) : $this->revalidation_cooldown;
        
        // Implement throttling to prevent too many requests
        $current_time = time();
        if ($current_time - $this->last_revalidation < $cooldown) {
            error_log("Next.js Revalidation: Throttled request for {$content_type} {$content_id}");
            $this->log_revalidation($content_type, $content_id, false, 'Throttled: Too many requests');
            return false;
        }
        $this->last_revalidation = $current_time;
        
        // Check if we have the required settings
        if (empty($this->options['next_url']) || empty($this->options['webhook_secret'])) {
            if (!empty($this->options['enable_notifications'])) {
                add_action('admin_notices', function() {
                    echo '<div class="notice notice-error is-dismissible"><p>Next.js revalidation failed: Missing URL or webhook secret. Please configure the plugin settings.</p></div>';
                });
            }
            error_log("Next.js Revalidation: Missing URL or webhook secret");
            $this->log_revalidation($content_type, $content_id, false, 'Missing URL or webhook secret');
            return false;
        }

        // Prepare API endpoint
        $endpoint = trailingslashit($this->options['next_url']) . 'api/revalidate';
        
        // Prepare request payload
        $payload = array(
            'contentType' => $content_type,
        );
        
        if ($content_id !== null) {
            $payload['contentId'] = $content_id;
        }

        error_log("Next.js Revalidation: Sending request to {$endpoint} for {$content_type} {$content_id}");
        
        // Send revalidation request
        $response = wp_remote_post($endpoint, array(
            'method' => 'POST',
            'timeout' => 5,
            'redirection' => 5,
            'httpversion' => '1.1',
            'headers' => array(
                'Content-Type' => 'application/json',
                'x-webhook-secret' => $this->options['webhook_secret']
            ),
            'body' => json_encode($payload),
            'sslverify' => true
        ));

        // Check for success
        if (is_wp_error($response)) {
            $error_message = $response->get_error_message();
            error_log('Next.js revalidation error: ' . $error_message);
            if (!empty($this->options['enable_notifications'])) {
                add_action('admin_notices', function() use ($response) {
                    echo '<div class="notice notice-error is-dismissible"><p>Next.js revalidation failed: ' . esc_html($response->get_error_message()) . '</p></div>';
                });
            }
            $this->log_revalidation($content_type, $content_id, false, $error_message);
            return false;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);
        $success = $status_code >= 200 && $status_code < 300;
        
        if ($success) {
            error_log("Next.js Revalidation: Success for {$content_type} {$content_id}");
            if (!empty($this->options['enable_notifications'])) {
                add_action('admin_notices', function() use ($content_type, $content_id) {
                    echo '<div class="notice notice-success is-dismissible"><p>Next.js site revalidated successfully due to ' . esc_html($content_type) . ' update' . ($content_id ? ' (ID: ' . esc_html($content_id) . ')' : '') . '</p></div>';
                });
            }
            $this->log_revalidation($content_type, $content_id, true, $body);
            return true;
        } else {
            error_log("Next.js revalidation failed with status {$status_code}: {$body}");
            if (!empty($this->options['enable_notifications'])) {
                add_action('admin_notices', function() use ($status_code, $body) {
                    echo '<div class="notice notice-error is-dismissible"><p>Next.js revalidation failed with status ' . esc_html($status_code) . ': ' . esc_html($body) . '</p></div>';
                });
            }
            $this->log_revalidation($content_type, $content_id, false, "Status {$status_code}: {$body}");
            return false;
        }
    }
}

// Initialize the plugin
$next_revalidation = new Next_Revalidation();