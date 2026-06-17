核心前置步驟：取得檔案的託管網址（免費且最推薦）
不論您用哪種方案，都必須先將程式碼檔案放到網路上。最簡單且完全免費的方法是使用 GitHub Pages：

註冊或登入 GitHub。
建立一個新的 Repository（檔案庫），命名為 watermark。
將本機的這些檔案上傳上去：
index.html
styles.css
app.js
opencv.js
opencv.wasm
samples/ 資料夾下的圖片
在該 Repository 的 Settings -> Pages 中，將 Build and deployment 的 Branch 設定為 main (或 master) 並存檔。
幾分鐘後，您會得到一個專屬網址，例如：https://<您的帳號>.github.io/watermark/。
取得網址後，請看以下在 Blogger 上的兩種整合步驟：

推薦做法：使用 iframe 嵌入 Blogger 的「獨立網頁」（最安全、最美觀）
為什麼最推薦此做法？ 因為去浮水印工具使用了深色主題（Dark Mode）與全螢幕佈局（100vh）。如果直接貼入 Blogger 文章中，工具的 CSS 會污染您整個部落格的版面，導致您部落格的背景變黑、字體變形。使用 iframe 可以將工具完美隔離，且不會破壞部落格原有版面。

步驟 1：建立 Blogger 獨立網頁
進入 Blogger 後台，點選左側選單的 「網頁」(Pages)。
點選 「新增網頁」(New Page)。
將網頁標題命名為例如 線上免安裝去浮水印工具。
步驟 2：切換至 HTML 編輯模式並貼上代碼
在編輯器左上角，點選鉛筆圖示，將模式從「撰寫檢視」切換為 「HTML 檢視」。
清空裡面的內容，貼上以下代碼（請將 src 替換成您前置步驟取得的 GitHub Pages 網址）：
html


<div style="width: 100%; text-align: center; margin: 20px 0;">
    <iframe 
        src="https://<您的帳號>.github.io/watermark/index.html" 
        width="100%" 
        height="850px" 
        style="border: none; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);"
        allow="download">
    </iframe>
</div>
點選右上角的 「發佈」。這樣您就有一個完美的、不會破壞部落格排版的去浮水印專屬頁面了！
