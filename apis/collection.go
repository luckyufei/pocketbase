package apis

import (
	"net/http"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/forms"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/search"
)

// bindCollectionApi registers the collection api endpoints and the corresponding handlers.
func bindCollectionApi(app core.App, rg *echo.Group) {
	api := collectionApi{app: app}

	subGroup := rg.Group("/collections", ActivityLogger(app))
	subGroup.GET("", api.list, RequireAdminOrRecordAuth())
	subGroup.POST("", api.create, RequireAdminOrRecordAuth())
	subGroup.GET("/:collection", api.view, RequireAdminOrRecordAuth())
	subGroup.PATCH("/:collection", api.update, RequireAdminOrRecordAuth())
	subGroup.DELETE("/:collection", api.delete, RequireAdminAuth())
	subGroup.PUT("/import", api.bulkImport)
}

type collectionApi struct {
	app core.App
}

func (api *collectionApi) list(c echo.Context) error {
	fieldResolver := search.NewSimpleFieldResolver(
		"id", "created", "updated", "name", "system", "type",
	)

	collections := []*models.Collection{}

	result, err := search.NewProvider(fieldResolver).
		Query(api.app.Dao().CollectionQuery()).
		ParseAndExec(c.QueryParams().Encode(), &collections)

	if err != nil {
		return NewBadRequestError("", err)
	}

	admin, _ := c.Get(ContextAdminKey).(*models.Admin)

	// 普通登录用户请求接口时, 要补充id/created/updated等系统字段
	if admin == nil {
		for _, collection := range collections {
			appendSystemFields(collection)
		}
	}

	event := new(core.CollectionsListEvent)
	event.HttpContext = c
	event.Collections = collections
	event.Result = result

	return api.app.OnCollectionsListRequest().Trigger(event, func(e *core.CollectionsListEvent) error {
		if e.HttpContext.Response().Committed {
			return nil
		}

		return e.HttpContext.JSON(http.StatusOK, e.Result)
	})
}

func (api *collectionApi) view(c echo.Context) error {
	collection, err := api.app.Dao().FindCollectionByNameOrId(c.PathParam("collection"))
	if err != nil || collection == nil {
		return NewNotFoundError("", err)
	}

	admin, _ := c.Get(ContextAdminKey).(*models.Admin)
	// 非admin用户访问时, 要补充系统字段
	if admin != nil {
		appendSystemFields(collection)
	}
	event := new(core.CollectionViewEvent)
	event.HttpContext = c
	event.Collection = collection

	return api.app.OnCollectionViewRequest().Trigger(event, func(e *core.CollectionViewEvent) error {
		if e.HttpContext.Response().Committed {
			return nil
		}

		return e.HttpContext.JSON(http.StatusOK, e.Collection)
	})
}

func (api *collectionApi) create(c echo.Context) error {
	collection := &models.Collection{}

	// only admin can create auth collection
	if collection.IsAuth() {
		admin, _ := c.Get(ContextAdminKey).(*models.Admin)
		if admin == nil {
			return NewUnauthorizedError("The request requires valid admin authorization token to be set.", nil)
		}
	}

	form := forms.NewCollectionUpsert(api.app, collection)

	// load request
	if err := c.Bind(form); err != nil {
		return NewBadRequestError("Failed to load the submitted data due to invalid formatting.", err)
	}

	event := new(core.CollectionCreateEvent)
	event.HttpContext = c
	event.Collection = collection

	// create the collection
	return form.Submit(func(next forms.InterceptorNextFunc[*models.Collection]) forms.InterceptorNextFunc[*models.Collection] {
		return func(m *models.Collection) error {
			event.Collection = m

			return api.app.OnCollectionBeforeCreateRequest().Trigger(event, func(e *core.CollectionCreateEvent) error {
				if err := next(e.Collection); err != nil {
					return NewBadRequestError("Failed to create the collection.", err)
				}

				return api.app.OnCollectionAfterCreateRequest().Trigger(event, func(e *core.CollectionCreateEvent) error {
					if e.HttpContext.Response().Committed {
						return nil
					}

					return e.HttpContext.JSON(http.StatusOK, e.Collection)
				})
			})
		}
	})
}

func (api *collectionApi) update(c echo.Context) error {
	collection, err := api.app.Dao().FindCollectionByNameOrId(c.PathParam("collection"))
	if err != nil || collection == nil {
		return NewNotFoundError("", err)
	}

	// only admin can update auth collection
	if collection.IsAuth() {
		admin, _ := c.Get(ContextAdminKey).(*models.Admin)
		if admin == nil {
			return NewUnauthorizedError("The request requires valid admin authorization token to be set.", nil)
		}
	}

	form := forms.NewCollectionUpsert(api.app, collection)

	// load request
	if err := c.Bind(form); err != nil {
		return NewBadRequestError("Failed to load the submitted data due to invalid formatting.", err)
	}

	event := new(core.CollectionUpdateEvent)
	event.HttpContext = c
	event.Collection = collection

	// update the collection
	return form.Submit(func(next forms.InterceptorNextFunc[*models.Collection]) forms.InterceptorNextFunc[*models.Collection] {
		return func(m *models.Collection) error {
			event.Collection = m

			return api.app.OnCollectionBeforeUpdateRequest().Trigger(event, func(e *core.CollectionUpdateEvent) error {
				if err := next(e.Collection); err != nil {
					return NewBadRequestError("Failed to update the collection.", err)
				}

				return api.app.OnCollectionAfterUpdateRequest().Trigger(event, func(e *core.CollectionUpdateEvent) error {
					if e.HttpContext.Response().Committed {
						return nil
					}

					return e.HttpContext.JSON(http.StatusOK, e.Collection)
				})
			})
		}
	})
}

func (api *collectionApi) delete(c echo.Context) error {
	collection, err := api.app.Dao().FindCollectionByNameOrId(c.PathParam("collection"))
	if err != nil || collection == nil {
		return NewNotFoundError("", err)
	}

	event := new(core.CollectionDeleteEvent)
	event.HttpContext = c
	event.Collection = collection

	return api.app.OnCollectionBeforeDeleteRequest().Trigger(event, func(e *core.CollectionDeleteEvent) error {
		if err := api.app.Dao().DeleteCollection(e.Collection); err != nil {
			return NewBadRequestError("Failed to delete collection due to existing dependency.", err)
		}

		return api.app.OnCollectionAfterDeleteRequest().Trigger(event, func(e *core.CollectionDeleteEvent) error {
			if e.HttpContext.Response().Committed {
				return nil
			}

			return e.HttpContext.NoContent(http.StatusNoContent)
		})
	})
}

func (api *collectionApi) bulkImport(c echo.Context) error {
	form := forms.NewCollectionsImport(api.app)

	// load request data
	if err := c.Bind(form); err != nil {
		return NewBadRequestError("Failed to load the submitted data due to invalid formatting.", err)
	}

	event := new(core.CollectionsImportEvent)
	event.HttpContext = c
	event.Collections = form.Collections

	// import collections
	return form.Submit(func(next forms.InterceptorNextFunc[[]*models.Collection]) forms.InterceptorNextFunc[[]*models.Collection] {
		return func(imports []*models.Collection) error {
			event.Collections = imports

			return api.app.OnCollectionsBeforeImportRequest().Trigger(event, func(e *core.CollectionsImportEvent) error {
				if err := next(e.Collections); err != nil {
					return NewBadRequestError("Failed to import the submitted collections.", err)
				}

				return api.app.OnCollectionsAfterImportRequest().Trigger(event, func(e *core.CollectionsImportEvent) error {
					if e.HttpContext.Response().Committed {
						return nil
					}

					return e.HttpContext.NoContent(http.StatusNoContent)
				})
			})
		}
	})
}

var (
	// 补充系统字段
	idField = &schema.SchemaField{
		System:   true,
		Name:     schema.FieldNameId,
		Type:     schema.FieldTypeText,
		Required: true,
		Unique:   true,
	}

	createdField = &schema.SchemaField{
		System:   true,
		Name:     schema.FieldNameCreated,
		Type:     schema.FieldTypeDate,
		Required: true,
	}

	updatedField = &schema.SchemaField{
		System:   true,
		Name:     schema.FieldNameUpdated,
		Type:     schema.FieldTypeDate,
		Required: true,
	}

	usernameField = &schema.SchemaField{
		System:   true,
		Name:     schema.FieldNameUsername,
		Type:     schema.FieldTypeText,
		Required: true,
	}

	emailField = &schema.SchemaField{
		System:   true,
		Name:     schema.FieldNameEmail,
		Type:     schema.FieldTypeEmail,
		Required: true,
	}

	emailVisibility = &schema.SchemaField{
		System:   true,
		Name:     schema.FieldNameEmailVisibility,
		Type:     schema.FieldTypeBool,
		Required: false,
	}

	verifiedField = &schema.SchemaField{
		System:   true,
		Name:     schema.FieldNameVerified,
		Type:     schema.FieldTypeBool,
		Required: false,
	}
)

func appendSystemFields(collection *models.Collection) {
	if collection.IsAuth() {
		collection.Schema.PrependField(idField, usernameField, emailField, emailVisibility, verifiedField)
	} else {
		collection.Schema.PrependField(idField)
	}
	if collection.IsBase() || collection.IsAuth() {
		collection.Schema.AddField(createdField)
		collection.Schema.AddField(updatedField)
	}
}
