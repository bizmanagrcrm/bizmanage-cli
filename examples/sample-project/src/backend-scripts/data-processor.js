/**
 * Data Processor Backend Script
 * Processes user data and generates analytics reports
 */

import _ from 'lodash';
import moment from 'moment';

/**
 * Main entry point for processing user data
 * @param {Array} userData - Array of user data objects
 * @returns {Object} Processing results
 */
export function processUserData(userData) {
    console.log(`Starting data processing for ${userData.length} users...`);
    
    const startTime = moment();
    
    try {
        // Group users by registration date
        const usersByDate = _.groupBy(userData, user => 
            moment(user.registrationDate).format('YYYY-MM-DD')
        );
        
        // Calculate analytics
        const analytics = {
            totalUsers: userData.length,
            activeUsers: userData.filter(user => user.isActive).length,
            usersByDate: Object.keys(usersByDate).map(date => ({
                date,
                count: usersByDate[date].length,
                activeCount: usersByDate[date].filter(user => user.isActive).length
            })),
            averageSessionDuration: _.meanBy(userData, 'sessionDuration'),
            topRegions: _(userData)
                .groupBy('region')
                .mapValues('length')
                .toPairs()
                .sortBy(1)
                .reverse()
                .take(5)
                .fromPairs()
                .value()
        };
        
        // Generate report
        const report = {
            generatedAt: moment().toISOString(),
            processingTime: moment().diff(startTime, 'milliseconds'),
            analytics,
            summary: {
                message: `Processed ${analytics.totalUsers} users successfully`,
                activeUserRate: (analytics.activeUsers / analytics.totalUsers * 100).toFixed(2) + '%',
                topRegion: Object.keys(analytics.topRegions)[0]
            }
        };
        
        console.log(`Data processing completed in ${report.processingTime}ms`);
        console.log(`Active user rate: ${report.summary.activeUserRate}`);
        
        return report;
        
    } catch (error) {
        console.error('Error processing user data:', error);
        throw new Error(`Data processing failed: ${error.message}`);
    }
}

/**
 * Validate user data before processing
 * @param {Array} userData - Array of user data objects
 * @returns {Object} Validation result
 */
export function validateUserData(userData) {
    const requiredFields = ['id', 'email', 'registrationDate', 'isActive'];
    const errors = [];
    
    if (!Array.isArray(userData)) {
        errors.push('User data must be an array');
        return { isValid: false, errors };
    }
    
    userData.forEach((user, index) => {
        requiredFields.forEach(field => {
            if (!(field in user)) {
                errors.push(`User ${index}: Missing required field '${field}'`);
            }
        });
        
        if (user.email && !isValidEmail(user.email)) {
            errors.push(`User ${index}: Invalid email format`);
        }
    });
    
    return {
        isValid: errors.length === 0,
        errors,
        validatedCount: userData.length
    };
}

/**
 * Helper function to validate email format
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
