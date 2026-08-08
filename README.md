# Vijana Beats

Build a modern, mobile-first, production-ready Music Streaming & Music Sharing Platform called **Vijana Brand**.





The platform should be clean, beautiful, fast, secure, and scalable.





Technology:





* React


* TypeScript


* TailwindCSS


* Supabase


* PostgreSQL


* Row Level Security (RLS)


* Supabase Storage


* Responsive Design


* PWA (Progressive Web App)


* Dark Mode & Light Mode


* Mobile First UI


* Clean Modern Dashboard





---





# PROJECT NAME





Vijana Brand





Tagline:





**Discover. Upload. Listen. Share.**





---





# USER ROLES





The system must have four roles.





## 1. Super Admin





This is the highest level user.





Has FULL PERMISSIONS.





Can:





* Create Admins


* Edit Admins


* Delete Admins


* Suspend Admins


* Activate Admins


* Manage every user


* Delete any account


* Reset passwords


* Manage all songs


* Delete songs


* Approve songs


* Reject songs


* Feature songs


* Pin songs


* View reports


* View statistics


* Manage categories


* Manage genres


* Manage audio watermark settings


* Manage advertisements (future ready)


* View storage usage


* View downloads


* Manage platform settings


* Manage homepage


* Manage announcements


* Manage logo


* Manage favicon


* Manage banners


* Manage Terms & Conditions


* Manage Privacy Policy


* Manage Contact Information


* Manage Social Media Links





---





## 2. Admin (Content Moderator)





Admins help moderate content.





Permissions:





* Approve songs


* Reject songs


* Delete inappropriate songs


* Hide songs


* Suspend singers


* Review reported comments


* Delete comments


* View reports





Cannot:





* Delete Super Admin


* Change platform settings


* Create Super Admins





---





## 3. Singer





Singer is a registered user.





Can:





* Register


* Login


* Edit Profile


* Upload Audio


* Upload Cover Image


* Edit Song


* Delete Own Song


* View Analytics


* See Downloads


* See Likes


* See Comments


* Reply to comments


* Share songs


* Receive notifications





---





## 4. Listener





Can:





Without Login





* Browse songs


* Search songs


* Listen to songs


* View singer profile


* View trending songs





With Login





* Like songs


* Comment


* Reply to comments


* Share


* Download songs


* Follow singers


* Save favorites


* Create playlists


* Report inappropriate content





---





# AUTHENTICATION





Create beautiful Authentication pages.





Register





Fields:





* Full Name


* Username


* Email


* Phone Number (Optional)


* Password


* Confirm Password





Requirements:





Password fields must have





👁 Show / Hide Password





Validation:





* Username unique


* Email unique


* Strong Password


* Password confirmation





Login





Fields





* Username or Email


* Password





Features





Remember Me





Forgot Password





Show Password Eye Icon





Stay Logged In





Logout





---





# HOMEPAGE





Guest users should immediately access the platform without logging in.





Homepage should include:





Hero Banner





Trending Songs





Latest Songs





Popular Songs





Recently Uploaded





Top Downloaded





Top Liked





Top Artists





Music Categories





Search Bar





Featured Songs





Footer





---





# SONG UPLOAD





Singer uploads





Fields





Song Title





Description





Genre





Language





Album (Optional)





Release Date





Cover Image





Audio File





Tags





Status





Uploaded Date





---





Allowed formats





MP3





WAV





AAC





Maximum size configurable





Store files inside Supabase Storage.





---





# AUDIO WATERMARK





This is one of the most important features.





Every uploaded audio should automatically receive an Audio Signature (Audio Watermark).





Example voice:





"Vijana Brand"





The watermark audio is configurable.





Only Super Admin can upload or replace the watermark audio.





Settings





Watermark Volume





Watermark Interval





Beginning only





Middle





End





Random Interval





Enable/Disable Watermark





The system should automatically process uploaded audio before publishing.





Original audio should remain private.





Only processed audio should be downloadable.





---





# MUSIC PLAYER





Beautiful Mobile Player





Features





Play





Pause





Seek





Volume





Repeat





Shuffle





Next





Previous





Sleep Timer





Playback Speed





Background Play





Mini Player





Full Screen Player





Display:





Cover Image





Song Title





Singer





Duration





Progress Bar





Download Button





Share Button





Like Button





Comment Button





Favorite Button





---





# DOWNLOAD





Logged in users only.





Download processed audio.





Track download count.





---





# COMMENTS





Nested Comments





Replies





Like Comment





Delete Own Comment





Edit Own Comment





Admin can delete any comment.





---





# LIKES





Like





Unlike





Real-time update





Display total likes.





---





# SHARING





Share to





WhatsApp





Facebook





Instagram





Telegram





X (Twitter)





Copy Link





Generate share link.





---





# SEARCH





Search by





Song





Singer





Genre





Album





Keyword





Recent searches





Popular searches





Filters





---





# SINGER PROFILE





Profile Picture





Cover Photo





Biography





Followers





Following





Uploaded Songs





Downloads





Likes





Total Plays





Joined Date





Social Links





---





# FAVORITES





Save favorite songs.





Favorite Playlist.





---





# PLAYLISTS





Create Playlist





Rename Playlist





Delete Playlist





Add Songs





Remove Songs





Public





Private





---





# NOTIFICATIONS





Likes





Comments





Replies





Followers





Song Approved





Song Rejected





Admin Messages





---





# ADMIN DASHBOARD





Statistics





Total Users





Total Singers





Total Songs





Pending Songs





Approved Songs





Rejected Songs





Downloads





Storage





Daily Uploads





Monthly Uploads





Charts





Recent Activities





---





# SONG MANAGEMENT





Approve





Reject





Delete





Hide





Feature





Pin





Edit





Search





Filter





Bulk Delete





Bulk Approve





---





# USER MANAGEMENT





View users





Suspend





Activate





Delete





Reset Password





View Activity





Search





Filter





---





# SETTINGS





Platform Name





Logo





Favicon





Homepage Banner





Footer





Social Links





Privacy Policy





Terms





Contact





Maintenance Mode





---





# DATABASE





Design normalized PostgreSQL database.





Tables





profiles





roles





songs





song_likes





comments





comment_likes





playlists





playlist_songs





downloads





notifications





genres





followers





reports





settings





admins





activity_logs





audio_watermarks





---





# STORAGE





Create buckets





covers





songs





processed_songs





avatars





banners





watermarks





---





# SECURITY





Use Supabase Auth





Use Row Level Security





Policies





Only owner edits own song.





Admins moderate.





Super Admin controls everything.





Guests read only approved songs.





---





# PERFORMANCE





Lazy Loading





Pagination





Infinite Scroll





Caching





Optimized Images





Optimized Audio Streaming





Fast Search





Responsive everywhere.





---





# MOBILE DESIGN





Prioritize Mobile UI.





Android first.





Large buttons





Smooth animations





Bottom Navigation





Floating Music Player





Beautiful Cards





Modern Typography





Premium Design





---





# FUTURE READY





Prepare architecture for:





Subscription Plans





Premium Music





Ads





Artist Verification





Live Streaming





Podcasts





Albums





Music Videos





Artist Earnings





Payments





M-Pesa





Airtel Money





Tigo Pesa





HaloPesa





Stripe





PayPal





---





# FINAL REQUIREMENTS





Build a complete production-ready application with:





* Clean architecture


* Reusable React components


* Proper folder structure


* TypeScript best practices


* Secure Supabase backend


* Responsive UI


* Modern UX


* Beautiful animations


* Error handling


* Loading skeletons


* Empty states


* Toast notifications


* Dark & Light Mode


* SEO friendly


* PWA support


* Fully documented code





The application should look and feel like a modern music platform comparable to Spotify or Audiomack, while focusing on music uploads by independent artists under the **Vijana Brand** platform. It must be optimized for smartphones first, with a premium, intuitive, and professional user experience.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://vijanabrand.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c54a1378-74c4-4df9-ae5e-83310dac30b8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
