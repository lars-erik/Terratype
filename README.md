# README #

### Purpose ###
Map datatype for Umbraco V7 

### Why? ###
Wish to give your content editors or grid editors easy Maps to set real world locations. 
 
### Usage ###
1. Install Terratype framework package via Nuget
   https://www.nuget.org/packages/Terratype/

2. Install the Map Providers you would like to use, you can install and use, simultaneously, multiple providers.
   https://www.nuget.org/packages/Terratype.GoogleMapsV3
   
   https://www.nuget.org/packages/Terratype.LeafletV1
   
   https://www.nuget.org/packages/Terratype.BingMapsV8
   
   
3. Create a new data type based off this the newly added Terratype property Editor. You may need to obtain any API Keys that are necessary 

4. Add this new data type to a document type

5. Create new content based off this document type

### Usage ###

https://github.com/Joniff/Terratype/blob/master/docs/manual.pdf


### Render ###

@using Terratype;

@Html.Terratype(Options, Map, @<text>Label</text>)




 
### Log ###

**1.0.12**

	All providers use .NET Framework 4.5
	Added Icon to Options, to be able to render custom icons 
	Fixed label issue for multiple Rendered GMaps 


**1.0.11**

	Fix for when providers are missing their default values
	Fixed Minor spelling mistakes
	Leaflet Map Icon is now static when rendered in razor
	
**1.0.10**

	Render error with map height and zoom in option 


**1.0.9**

	Added Bing Maps
	Leaflet not displaying
	Switching between providers in config now smoother


**1.0.8**

	Fixed option error in FireFox

	
**1.0.7**

	@Html.Terratype() now handles dynamic values
	Added Leaflet Provider
	Remove labels from frontend when no label is present
	Improved provider loading

	
**1.0.6**

	Error when creating Google Maps without an API Key present

	
**1.0.5**

	Added native Grid editor to allow terratype maps to be added/edited and rendered inside grids (With no coding required)
	Added native Datum values to each Coordinate System

	
**1.0.4**

	Fixed error with Null types in assemblies
	Fixed error with map height for IE in Umbraco backend only
	Added content editable Labels to maps


**1.0.3**

	Error checking for providers fixed


**1.0.2**

	Removed reliance on terratype map provider having to be same version as terratype

	
**1.0.1**

	Removed hardcoded /umbraco/ references


**1.0.0**

	Complete rewrite based from AngularGoogleMaps.

	
### Source code ###

Download the source code, it should work for Visual Studio 2013 & 2015. If you set **Terratype.TestSite** as your **Set as Startup project** this should execute the test Umbraco website, where you can test maps under different scenarios. Once running, surf to http://localhost:60389/umbraco and at the login type **admin** for user and **password** for password.

