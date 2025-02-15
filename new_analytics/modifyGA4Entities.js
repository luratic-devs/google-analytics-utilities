/**
 * Copyright 2022 Google LLC
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Modifies GA4 custom dimensions.
 */
function modifyGA4CustomDimensions() {
  modifyGA4Entities(sheetsMeta.ga4.customDimensions.sheetName);
}

/**
 * Modifies GA4 custom metrics.
 */
function modifyGA4CustomMetrics() {
  modifyGA4Entities(sheetsMeta.ga4.customMetrics.sheetName);
}

/**
 * Modifies GA4 conversion events.
 */
function modifyGA4ConversionEvents() {
  modifyGA4Entities(sheetsMeta.ga4.conversionEvents.sheetName);
}

/**
 * Modifies GA4 Google Ads Links.
 */
function modifyGA4AdsLinks() {
  modifyGA4Entities(sheetsMeta.ga4.googleAdsLinks.sheetName);
}

/**
 * Modifies GA4 Firebase links.
 */
function modifyGA4FirebaseLinks() {
  modifyGA4Entities(sheetsMeta.ga4.firebaseLinks.sheetName);
}

/**
 * Modifies GA4 DV360 links.
 */
function modifyGA4DV360Links() {
  modifyGA4Entities(sheetsMeta.ga4.displayVideo360AdvertiserLinks.sheetName);
}

/**
 * Modifies GA4 properties.
 */
function modifyGA4Properties() {
  Logger.log(sheetsMeta.ga4.properties.sheetName);
  modifyGA4Entities(sheetsMeta.ga4.properties.sheetName);
}

/**
 * Modifies GA4 streams.
 */
function modifyGA4Streams() {
  modifyGA4Entities(sheetsMeta.ga4.streams.sheetName);
}

/**
 * Loops through the rows on the sheet with data and checks either
 * skips, updates, removes, or creates an entity depending on what
 * was checked in a given sheet.
 * @param {string} sheetName The name of the sheet from which
 * the data will be retrieved.
 */
function modifyGA4Entities(sheetName) {
  let entities = getDataFromSheet(sheetName);
  const ga4Resource = Object.keys(sheetsMeta.ga4).find(
    key => sheetsMeta.ga4[key].sheetName === sheetName);
  filteredEntity = entities.filter(
		entity => entity[3] != '');
  if (filteredEntity.length > 0) {
    filteredEntity.forEach((entity, index) => {
      let response = null;
      const remove = entity[entity.length - 4];
      const create = entity[entity.length - 3];
      const update = entity[entity.length - 2];
      let actionTaken = null;

      // Data consistent across GA4 sheets.
			const propertyPath = 'properties/' + entity[3];
			let entityPath = entity[5];
      if (sheetName == sheetsMeta.ga4.properties.sheetName) {
        entityPath = propertyPath;
      }
      // An entity cannot be both created and archived/deleted, so if both
      // are true, then the response is null and row is marked as skipped.
      if ((remove && create) || (remove && update) || (update && create)) {
        actionTaken = apiActionTaken.ga4.skipped;
        // Writes that the entity was skipped to the sheet.
        writeActionTakenToSheet(sheetName, index, actionTaken);

      // Archives custom definitions and deletes anything else that can be deleted.
      } else if (remove) {
        if (
          sheetName == sheetsMeta.ga4.customDimensions.sheetName ||
          sheetName == sheetsMeta.ga4.customMetrics.sheetName) {
          response = archiveGA4CustomDefinition(ga4Resource, entityPath);
          if (response.length == undefined) {
            actionTaken = apiActionTaken.ga4.archived;
          } else {
            actionTaken = apiActionTaken.ga4.error;
          }
        } else {
          response = deleteGA4Entity(ga4Resource, entityPath);
          if (response.length == undefined) {
            actionTaken = apiActionTaken.ga4.deleted;
          } else {
            actionTaken = apiActionTaken.ga4.error;
          }
        }
        // Writes that the entity was deleted or archived to the sheet.
        writeActionTakenToSheet(sheetName, index, actionTaken);

      // Creates the new entity.
      } else if (create) {
        const payload = buildCreatePayload(sheetName, entity);
        response = createGA4Entity(ga4Resource, propertyPath, payload);
        // Writes the creation of the entity to the sheet.
        writeActionTakenToSheet(sheetName, index, apiActionTaken.ga4.created);

      // Updates entities.
      } else if (update) {
        const payload = buildUpdatePayload(sheetName, entity);
        response = updateGA4Entity(ga4Resource, entityPath, payload, index);
        writeActionTakenToSheet(sheetName, index, apiActionTaken.ga4.updated);
      }
    });
  }
}

/**
 * Builds the payload sent to the API to create an entity.
 * @param {string} sheetName The name of the sheet from which
 * the data will be retrieved.
 * @param {!Array<!Array>} entity  A two dimensional array where each
 * inner array contains metadata about a given entity.
 */
function buildCreatePayload(sheetName, entity) {
  const payload = {};
  const entityDisplayNameOrId = entity[4];
  if (sheetName == sheetsMeta.ga4.customDimensions.sheetName ||
  sheetName == sheetsMeta.ga4.customMetrics.sheetName) {
    // Add custom dimension or metric fields.
    const parameterName = entity[6];
    const scope = entity[7];
    const description = entity[9];
    payload.displayName = entityDisplayNameOrId;
    payload.scope = scope;
    payload.description = description;
    payload.parameterName = parameterName;     
    if (sheetName == sheetsMeta.ga4.customDimensions.sheetName) {
      // Add custom dimension fields.
      const disallowAdsPersonalization = entity[8];
      payload.disallowAdsPersonalization = disallowAdsPersonalization || false;
    } else if (sheetName == sheetsMeta.ga4.customMetrics.sheetName) {
      // Add custom metric fields.
      const measurementUnit = entity[8];
      payload.measurementUnit = measurementUnit;
    }
  } else if (sheetName == sheetsMeta.ga4.conversionEvents.sheetName) {
    // Add conversion event fields.
    payload.eventName = entityDisplayNameOrId;
  } else if (sheetName == sheetsMeta.ga4.googleAdsLinks.sheetName) {
    // Add Google Ads link fields.
    const canManageClients = entity[6];
    const adsPersonalizationEnabled = entity[7];
    payload.customerId = entityDisplayNameOrId;
    payload.canManageClients = canManageClients;
    payload.adsPersonalizationEnabled = adsPersonalizationEnabled;
  } else if (sheetName == sheetsMeta.ga4.firebaseLinks.sheetName) {
    // Add Firebase link fields.
    const maximumUserAccess = entity[7];
    payload.project = entityDisplayNameOrId;
    payload.maximumUserAccess = maximumUserAccess;
  } else if (sheetName == sheetsMeta.ga4.displayVideo360AdvertiserLinks.sheetName) {
    // Add DV360 link fields.
    payload.advertiserId = entityDisplayNameOrId;
    payload.adsPersonalizationEnabled = entity[7];
    payload.campaignDataSharingEnabled = entity[8];
    payload.costDataSharingEnabled = entity[9];
  } else if (sheetName == sheetsMeta.ga4.properties.sheetName) {
    // Add fields to modify a property.
    payload.displayName = entity[2];
    payload.industryCategory = entity[6];
    payload.timeZone = entity[7];
    payload.currencyCode = entity[8];
  } else if (sheetName == sheetsMeta.ga4.streams.sheetName) {
    payload.displayName = entity[4];
    payload.type = entity[6];
    if (payload.type == 'WEB_DATA_STREAM') {
      payload.webStreamData = {
        defaultUri: entity[13]
      }
    } else if (payload.type == 'ANDROID_APP_DATA_STREAM') {
      payload.androidAppStreamData = {
        packageName: entity[7]
      }
    } else if (payload.type == 'IOS_APP_DATA_STREAM') {
      payload.iosAppStreamData = {
        bundleId: entity[8]
      }
    }
  }
  return payload;
}

/**
 * Builds the payload sent to the API to update an entity.
 * @param {string} sheetName The name of the sheet from which
 * the data will be retrieved.
 * @param {!Array<!Array>} entity  A two dimensional array where each
 * inner array contains metadata about a given entity.
 */
function buildUpdatePayload(sheetName, entity) {
  const payload = {};
  const entityDisplayNameOrId = entity[4];
  if (sheetName == sheetsMeta.ga4.customDimensions.sheetName ||
  sheetName == sheetsMeta.ga4.customMetrics.sheetName) {
    // Add custom dimension or metric fields.
    const description = entity[9];
    payload.displayName = entityDisplayNameOrId;
    payload.description = description;
    if (sheetName == sheetsMeta.ga4.customDimensions.sheetName) {
      // Add custom dimension fields.
      const disallowAdsPersonalization = entity[8];
      payload.disallowAdsPersonalization = disallowAdsPersonalization || false;
    } else if (sheetName == sheetsMeta.ga4.customMetrics.sheetName) {
      // Add custom metric fields.
      const measurementUnit = entity[8];
      payload.measurementUnit = measurementUnit;
    }
  } else if (sheetName == sheetsMeta.ga4.googleAdsLinks.sheetName) {
    // Add Google Ads link fields.
    const adsPersonalizationEnabled = entity[7];
    payload.adsPersonalizationEnabled = adsPersonalizationEnabled;
  } else if (sheetName == sheetsMeta.ga4.displayVideo360AdvertiserLinks.sheetName) {
    // Add DV360 link fields.
    payload.adsPersonalizationEnabled = entity[7];
  } else if (sheetName == sheetsMeta.ga4.properties.sheetName) {
    // Add fields to modify a property.
    payload.displayName = entity[2];
    payload.industryCategory = entity[6];
    payload.timeZone = entity[7];
    payload.currencyCode = entity[8];
  } else if (sheetName == sheetsMeta.ga4.streams.sheetName) {
    payload.displayName = entity[4];
    if (entity[6] == 'WEB_DATA_STREAM') {
      payload.webStreamData = {
        defaultUri: entity[13]
      }
    } else if (entity[6] == 'ANDROID_APP_DATA_STREAM') {
      payload.androidAppStreamData = {
        packageName: entity[7]
      }
    } else if (entity[6] == 'IOS_APP_DATA_STREAM') {
      payload.iosAppStreamData = {
        bundleId: entity[8]
      }
    }
  }
  return payload;
}